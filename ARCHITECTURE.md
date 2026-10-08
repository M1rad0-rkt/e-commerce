# Plateforme d'offres — Architecture & direction artistique

Nom de travail : **Comptoir** (neutre : fonctionne pour produits comme services ; renommable en une ligne de config).

---

## ÉTAPE 1 — Architecture technique

### 1.1 Terminologie : `Offer`

Choix : **`Offer`**.
- `Product` exclut les services ; `Item` est trop vague (se confond avec `OrderItem`) ; `Listing` implique une marketplace (annonces de tiers).
- `Offer` = "ce qu'on propose à un client", vrai pour un casque, un logo ou une séance photo. Le mot colle aussi au vocabulaire commercial (offre, devis, promotion).

### 1.2 Modèle de données : cœur commun + extensions ciblées

Principe : **une table `offers` pour tout ce qui est commun**, puis des extensions uniquement là où la structure est vraiment différente. Pas de héritage SQL complexe (joined-table inheritance) : trop lourd pour le gain.

| Besoin | Stockage | Pourquoi |
|---|---|---|
| Champs communs (titre, prix, catégorie, image, note…) | `offers` | requêtes catalogue simples et rapides |
| Stock, poids, dimensions | `physical_details` (1–1) | colonnes typées, contraintes, index sur le stock |
| Créneaux / disponibilités | `booking_slots` (1–N) | on doit les interroger et les verrouiller |
| Durée, prestations incluses, format, taille de fichier, etc. | `offers.attributes` (JSONB) | varie par type, pas besoin de requêter finement, évolutif sans migration |
| Caractéristiques filtrables | `offer_attributes` (clé/valeur) *(étape ultérieure)* | filtres dynamiques par type |

Règle de décision : **colonne typée si on filtre, verrouille ou fait des contraintes dessus ; JSONB sinon.**

#### Tables principales

```text
users            id, email, hashed_password, full_name, role (USER|PROVIDER|ADMIN), is_active, created_at
categories       id, name, slug, parent_id, applies_to (offer_type[]), position, is_active
offers           id, title, slug (unique), description, offer_type, price, old_price,
                 price_mode (FIXED|STARTING_AT|QUOTE), currency, category_id, owner_id,
                 image, gallery (JSONB), attributes (JSONB), rating_avg, rating_count,
                 is_active, is_featured, published_at, created_at, updated_at
physical_details offer_id (PK/FK), stock, weight_g, dimensions (JSONB), sku
booking_slots    id, offer_id, starts_at, ends_at, capacity, booked_count
orders           id, user_id, status, subtotal, shipping_cost, total, currency,
                 shipping_address (JSONB), customer_info (JSONB), created_at
order_items      id, order_id, offer_id, offer_snapshot (JSONB), quantity, unit_price, metadata (JSONB)
bookings         id, user_id, offer_id, slot_id, order_item_id, status, notes, created_at
reviews          id, user_id, offer_id, rating (1-5), comment, created_at   -- UNIQUE(user_id, offer_id)
favorites        user_id, offer_id, created_at                              -- PK(user_id, offer_id)
addresses        id, user_id, label, line1, line2, city, postal_code, country
quote_requests   id, user_id, offer_id, message, status, created_at       -- offres price_mode=QUOTE
```

Décisions importantes :
- `offer_type` : enum `PHYSICAL_PRODUCT | SERVICE | DIGITAL_PRODUCT | BOOKING`.
- `price_mode` sépare *"à partir de"* et *"sur devis"* du type : un service peut être à prix fixe ou sur devis.
- `order_items.offer_snapshot` : copie du titre/prix/type au moment de l'achat, pour que l'historique ne change pas si l'offre est modifiée.
- `order_items.metadata` (JSONB) : date, créneau, durée, options, lieu.
- `rating_avg / rating_count` dénormalisés dans `offers` (mis à jour à chaque avis) pour trier vite par note.
- Catégories : `applies_to` permet de limiter une catégorie à certains types.

### 1.3 Comportement par type : registre de "capacités"

Pour éviter des `if type == ...` partout, chaque type déclare **ce qu'il sait faire** à un seul endroit.

Backend (`app/services/offer_types.py`) :

```python
OFFER_TYPE_CONFIG = {
  "PHYSICAL_PRODUCT": {"has_stock": True,  "needs_shipping": True,  "needs_slot": False, "primary_action": "ADD_TO_CART",    "quantity_mode": "UNITS"},
  "DIGITAL_PRODUCT":  {"has_stock": False, "needs_shipping": False, "needs_slot": False, "primary_action": "BUY_NOW",        "quantity_mode": "NONE"},
  "SERVICE":          {"has_stock": False, "needs_shipping": False, "needs_slot": False, "primary_action": "ORDER_SERVICE",  "quantity_mode": "SESSIONS"},
  "BOOKING":          {"has_stock": False, "needs_shipping": False, "needs_slot": True,  "primary_action": "BOOK",           "quantity_mode": "NONE"},
}
```

L'API renvoie ces capacités dans chaque offre (`capabilities`, `primary_action`). Le frontend a le miroir (`src/offers/offerTypes.ts`) pour les libellés, icônes et formulaires. **Ajouter un type = une entrée de config + un composant de détail + un schéma de métadonnées.**

Si `price_mode = QUOTE`, l'action devient `REQUEST_QUOTE` quel que soit le type.

### 1.4 Workflows de commande

Un seul `Order`, plusieurs parcours selon les lignes du panier :

```text
Panier ──► analyse des lignes ──► étapes de checkout déduites
  produit physique → Contact → Adresse → Livraison → Paiement
  numérique        → Contact → Paiement
  service          → Contact → Détails de la demande → Paiement
  réservation      → Contact → Créneau → Paiement
  devis            → Contact → Message → (pas de paiement, QuoteRequest)
```

Le frontend calcule les étapes depuis `capabilities` des lignes ; le backend **revalide tout** (stock, créneau libre, prix) à la création de la commande, dans une transaction.

Statuts : `PENDING → CONFIRMED → IN_PROGRESS → COMPLETED` (+ `CANCELLED`, `REFUNDED`) ; `SHIPPED/DELIVERED` pour le physique ; `ACCEPTED/REFUSED` pour les réservations.

### 1.5 Backend

```text
backend/
├── app/
│   ├── api/
│   │   ├── dependencies.py        # get_db, get_current_user, require_admin
│   │   └── routes/                # auth, users, offers, categories, orders, bookings, favorites, reviews, admin/
│   ├── core/                      # config (pydantic-settings), security (JWT, hash)
│   ├── db/                        # base, session, seed
│   ├── models/                    # SQLAlchemy 2.0 (Mapped[...])
│   ├── schemas/                   # Pydantic v2 (entrée/sortie séparées)
│   ├── services/                  # logique métier (offer_types, orders, bookings, search)
│   └── main.py
├── alembic/
├── tests/
├── .env.example  requirements.txt  Dockerfile  README.md
```

Règles : routes fines, logique dans `services/`, jamais de modèle SQLAlchemy renvoyé directement. Mots de passe hashés (bcrypt/argon2), JWT access (30 min) + refresh (7 j), rôles vérifiés par dépendance.

### 1.6 API

Paramètres de `GET /api/offers` : `q`, `type`, `category`, `min_price`, `max_price`, `in_stock`, `min_rating`, `promo`, `featured`, `sort` (`relevance|newest|price_asc|price_desc|rating|popular`), `page`, `page_size`.
Réponse paginée : `{ items, total, page, page_size, facets }` — les `facets` (comptes par type/catégorie) alimentent des filtres dynamiques.

Détail d'offre : `/api/offers/{slug}` (public, SEO) ; `/api/offers/{id}` réservé aux opérations par id. Routes admin sous `/api/admin/*` avec rôle `ADMIN`. Ajouts utiles : `/api/offers/{id}/reviews`, `/api/offers/{id}/slots`, `/api/quote-requests`, `/api/users/me/addresses`.

Recherche : `ILIKE` + `pg_trgm` au départ (suffisant, simple) ; `tsvector` français si le volume le justifie.

### 1.7 Frontend

```text
frontend/src/
├── components/{offers,layout,forms,ui}/
├── offers/              # offerTypes.ts (config), détails par type : PhysicalDetail, ServiceDetail, BookingDetail, DigitalDetail
├── pages/               # Home, Explore, OfferDetail, Cart, Checkout, Account/*, Admin/*, Auth/*
├── layouts/  hooks/  services/  context/  utils/
```

- **Routes** : `/`, `/explorer`, `/categories/:slug`, `/offers/:slug`, `/panier`, `/commande`, `/compte/*`, `/admin/*`, `/connexion`, `/inscription`.
- **Données serveur** : TanStack Query (cache, loading/error, pagination). **État client** : Context pour auth + panier (persisté localStorage). Pas de Redux.
- **Formulaires** : React Hook Form + Zod.
- **Détail d'offre** : `OfferDetail` charge l'offre puis délègue à un composant par type via une table `type → composant`.
- **OfferCard** : une carte, la zone d'action vient de `primary_action` (Ajouter au panier / Voir le service / Réserver / Demander un devis / Acheter).
- **SEO** : react-helmet-async pour titres/meta par offre ; JSON-LD `Product`/`Service` ; slugs. Limite à noter : une SPA est moins bien indexée qu'un rendu serveur — si le SEO devient critique, migrer le front public vers un SSR/prerender, l'API ne change pas.
- **Performance** : routes en `React.lazy`, images `loading="lazy"` + `srcset`, skeletons, pagination.

### 1.8 Infra

Docker Compose : `db` (postgres:16), `backend` (uvicorn), `frontend` (Vite dev / Nginx en prod). `.env.example` avec `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`, `API_URL`. Aucun secret versionné.

### 1.9 Paiement (point ouvert)

Le paiement réel dépend du modèle et du pays. Prévoir une interface `PaymentProvider` ; démarrer avec un fournisseur factice (statut simulé). Stripe est limité à certains pays ; pour Madagascar, des solutions mobile money / agrégateurs locaux sont à étudier. À décider avant l'étape 11.

---

## ÉTAPE 2 — Direction artistique

### 2.1 Idée directrice : « le comptoir / l'étiquette »

Éviter le look "SaaS" en s'inspirant de l'univers **papeterie, étiquettes d'inventaire, tampons, catalogues imprimés**. Une offre ressemble à une **fiche étiquetée** : c'est neutre (marche pour un casque comme pour une séance photo) et très reconnaissable.

### 2.2 Palette

| Rôle | Couleur | Usage |
|---|---|---|
| Papier | `#F2ECE0` | fond principal |
| Papier clair | `#FAF7F0` | cartes, surfaces |
| Encre | `#1A1916` | texte, bordures |
| Terracotta | `#C4432B` | action principale, accent fort |
| Vert sapin | `#1F3B34` | sections sombres, prestataires |
| Ocre | `#E2A82B` | badges, promo, étoiles |
| Bleu pâle | `#CFE0E6` | fond de visuels de services |

Pas de dégradé de fond. Aplats, bordures nettes de 1,5 px en encre, ombres dures décalées (`4px 4px 0 encre`) plutôt que des ombres floues.

### 2.3 Typographie

- Titres : **Fraunces** (serif expressif, optical sizes) — gros, serré, avec italiques sur des mots clés.
- Texte/UI : **Instrument Sans** (ou Geist).
- Détails (type, prix, références) : **JetBrains Mono** en petites capitales, comme des étiquettes.

### 2.4 Signatures visuelles

1. **Tampon de type** : chaque offre porte un tampon rond/rectangulaire (PRODUIT, SERVICE, RÉSERVATION, NUMÉRIQUE) avec une couleur et un pictogramme propres. C'est le fil conducteur du système.
2. **Bord perforé** : les cartes d'offre ont un bord détachable en pointillé séparant visuel et infos (clin d'œil ticket/étiquette).
3. **Visuels uniformisés** : cadre à ratio fixe, fond teinté par type ; photo produit détourée, illustration de service ou pictogramme pour le numérique — cohérent quel que soit le contenu.
4. **Numérotation** : références type `N° 0042` en mono, sur les cartes et les sections.
5. **Rythme asymétrique** : grille de 12 colonnes avec sections décalées, pas de bandes toutes identiques.

### 2.5 Hero

Accroche (provisoire, à valider) :
> **« Trouvez-le. Réservez-le. Recevez-le. »** — *Tout ce dont vous avez besoin, au même comptoir.*

Composition : à gauche titre en Fraunces avec un mot en italique terracotta, barre de recherche large (avec choix de type en pastilles) ; à droite un **collage de 3 fiches d'offres légèrement inclinées** (un casque, un logo, une séance photo) avec leurs tampons, qui se redressent au survol. CTA principal : *Explorer les offres* ; secondaire : *Proposer mon offre* (utile si marketplace).

### 2.6 Page d'accueil — structure et rythme

1. Hero + recherche
2. **Bandeau "Que cherchez-vous ?"** : 4 grandes tuiles de type (pas des cartes identiques : tailles et couleurs différentes)
3. **Populaires** : défilement horizontal avec 1 carte "vedette" plus grande
4. **Mise en avant** (bloc plein largeur vert sapin : offre, collection ou promo, piloté par le back)
5. **Catégories** : liste typographique géante (style index de catalogue), pas de cartes
6. **Nouveautés** : grille asymétrique
7. **Avantages** : une ligne de 4 points avec icônes en traits
8. **Avis** : citations de tailles différentes, façon coupures de presse
9. Pied de page riche

### 2.7 Mouvement

Sobre : apparition douce au scroll (une fois), redressement des fiches au survol, tampon qui "s'applique" à l'ajout au panier. Respect de `prefers-reduced-motion`.

### 2.8 Mobile first

Navigation basse à 4 icônes (Accueil, Explorer, Favoris, Panier) + tiroir pour le reste ; filtres dans un panneau plein écran ; cartes en 1 colonne dès 320 px, 2 colonnes à partir de 375 px pour les petites fiches.

### 2.9 Accessibilité

Contraste AA vérifié (terracotta sur papier ≥ 4,5:1 pour le texte), focus visibles, tampons avec texte (pas seulement couleur), alt sur toutes les images.

---

## Décisions à valider avant l'étape 3

1. **Nom** : « Comptoir » te convient-il, ou autre nom ?
2. **Monnaie** : € (comme dans ton brief) ou Ariary ? Le modèle gère `currency`, mais l'affichage et le paiement en dépendent.
3. **Rôle prestataire** : les offres sont-elles créées uniquement par l'admin (boutique) ou aussi par des prestataires (marketplace) ? Le modèle le permet (`owner_id`, rôle `PROVIDER`), mais cela change l'interface admin.
4. **Paiement** : fournisseur factice pour commencer, d'accord ?
5. **Tailwind** : je pars sur Tailwind v4 + variables CSS pour la palette.

## Feuille de route

| Étapes | Contenu |
|---|---|
| 3 | Structure `backend/` + `frontend/`, Docker Compose, `.env.example`, `.gitignore` |
| 4 | PostgreSQL, SQLAlchemy 2.0, Alembic |
| 5–6 | Modèle `Offer`, extensions, registre des types, seed |
| 7 | API (auth, offres, catégories, filtres, pagination) |
| 8–10 | Accueil, catalogue + `OfferCard`, détail dynamique |
| 11 | Panier, checkout multi-parcours, réservations |
| 12–13 | Auth + espace utilisateur, administration |
| 14 | Tests, responsive, performance |
