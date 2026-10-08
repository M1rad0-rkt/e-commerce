"""Données de démonstration.

Usage (depuis backend/, environnement virtuel activé) :
    python -m app.db.seed            # remplit la base si elle est vide
    python -m app.db.seed --reset    # vide les tables puis remplit

Mots de passe : lus dans SEED_ADMIN_PASSWORD / SEED_DEMO_PASSWORD (variables
d'environnement ou .env), sinon générés au hasard et affichés une seule fois.
Ces offres sont fictives et ne lient pas la plateforme à un type de vente.
"""

import os
import secrets
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models import (
    BookingSlot,
    Category,
    Offer,
    OfferType,
    PhysicalDetails,
    PriceMode,
    Review,
    User,
    UserRole,
)
from app.services.offers import refresh_rating
from app.services.slugs import slugify

CATEGORIES = [
    ("High-tech & audio", 1),
    ("Mode & accessoires", 2),
    ("Papeterie", 3),
    ("Création graphique", 4),
    ("Web & numérique", 5),
    ("Photo & image", 6),
    ("Cours & conseil", 7),
]

P, S, D, B = (
    OfferType.PHYSICAL_PRODUCT,
    OfferType.SERVICE,
    OfferType.DIGITAL_PRODUCT,
    OfferType.BOOKING,
)

# (titre, type, prix, ancien prix, mode, catégorie, vedette, jours depuis publication,
#  description, attributs, détails physiques, créneaux)
OFFERS = [
    dict(
        title="Casque audio sans fil Nomade", type=P, price=79, old=99, cat="High-tech & audio",
        featured=True, days=3,
        description="Un casque fermé pensé pour les trajets : réduction de bruit active, 30 heures d'autonomie et un arceau qui se replie dans le sac.",
        attributes={
            "specs": {"Autonomie": "30 h", "Connexion": "Bluetooth 5.3", "Poids": "280 g", "Réduction de bruit": "Active"},
            "delivery": "Livraison en 3 à 5 jours ouvrés",
        },
        physical=dict(stock=24, weight_g=280, sku="CASQ-NOM-01", dimensions={"l": 19, "h": 21, "p": 8}),
    ),
    dict(
        title="Sac à dos en toile cirée", type=P, price=64, old=80, cat="Mode & accessoires",
        featured=False, days=9,
        description="Toile cirée déperlante, doublure imprimée, fermeture à rabat avec boucle en laiton. Une poche pour ordinateur 15 pouces.",
        attributes={
            "specs": {"Matière": "Toile cirée", "Capacité": "22 L", "Poche ordinateur": "15 pouces"},
            "delivery": "Livraison en 3 à 5 jours ouvrés",
        },
        physical=dict(stock=12, weight_g=720, sku="SAC-TOILE-22", dimensions={"l": 30, "h": 44, "p": 14}),
    ),
    dict(
        title="Hub USB-C 7 ports", type=P, price=39, old=None, cat="High-tech & audio",
        featured=False, days=15,
        description="Sept ports dans un boîtier en aluminium : HDMI 4K, deux USB-A, lecteur SD et microSD, charge passante 100 W.",
        attributes={
            "specs": {"Ports": "7", "Vidéo": "HDMI 4K 30 Hz", "Charge passante": "100 W"},
            "delivery": "Livraison en 2 à 4 jours ouvrés",
        },
        physical=dict(stock=40, weight_g=95, sku="HUB-USBC-7", dimensions={"l": 11, "h": 1.5, "p": 4}),
    ),
    dict(
        title="Carnet relié à la main", type=P, price=18, old=None, cat="Papeterie",
        featured=False, days=21,
        description="Couture japonaise, papier ivoire 100 g, couverture en papier népalais. Chaque carnet est unique.",
        attributes={
            "specs": {"Format": "A5", "Pages": "160", "Papier": "Ivoire 100 g"},
            "delivery": "Expédié sous 5 jours",
        },
        physical=dict(stock=0, weight_g=240, sku="CARN-A5-01", dimensions={"l": 15, "h": 21, "p": 2}),
    ),
    dict(
        title="Pack de 120 icônes SVG", type=D, price=19, old=None, cat="Création graphique",
        featured=True, days=5,
        description="Un jeu d'icônes cohérent au trait de 1,5 px, livré en SVG et PNG. Idéal pour une application, un site ou une présentation.",
        attributes={
            "format": "SVG, PNG", "file_size": "18 Mo", "license": "Usage commercial, projets illimités",
            "included": ["120 icônes en SVG", "Export PNG 64, 128 et 256 px", "Fichier de licence"],
        },
    ),
    dict(
        title="Guide PDF « Lancer sa petite boutique »", type=D, price=12, old=None, cat="Web & numérique",
        featured=False, days=26,
        description="Soixante-quatre pages pour passer de l'idée à la première vente : choisir son offre, fixer ses prix, présenter ses fiches, organiser les commandes.",
        attributes={
            "format": "PDF", "file_size": "4,2 Mo", "license": "Usage personnel",
            "included": ["64 pages illustrées", "Modèles de fiches à remplir"],
        },
    ),
    dict(
        title="Création de logo", type=S, price=120, old=None, mode=PriceMode.STARTING_AT,
        cat="Création graphique", featured=True, days=2,
        description="Un logo conçu à partir de votre activité : recherche, trois pistes, deux séries de retouches, puis les fichiers prêts à l'emploi.",
        attributes={
            "duration": "5 à 7 jours", "provider_name": "Atelier Tsara", "availability": "Démarrage sous 48 h",
            "included": ["3 pistes graphiques", "2 séries de retouches", "Fichiers SVG, PNG et PDF", "Mini-guide d'utilisation"],
        },
    ),
    dict(
        title="Site web vitrine", type=S, price=250, old=None, mode=PriceMode.STARTING_AT,
        cat="Web & numérique", featured=True, days=7,
        description="Un site de cinq pages, rapide et lisible sur mobile, avec formulaire de contact et mise en ligne comprise.",
        attributes={
            "duration": "2 à 3 semaines", "provider_name": "Atelier Tsara", "availability": "Démarrage sous 1 semaine",
            "included": ["Jusqu'à 5 pages", "Version mobile", "Formulaire de contact", "Mise en ligne"],
        },
    ),
    dict(
        title="Rédaction de fiches descriptives", type=S, price=None, old=None, mode=PriceMode.QUOTE,
        cat="Web & numérique", featured=False, days=12,
        description="Des textes clairs pour présenter vos offres. Le tarif dépend du nombre de fiches et de leur longueur : décrivez votre besoin, vous recevrez un devis.",
        attributes={
            "duration": "Selon le volume", "provider_name": "Plume & Co", "availability": "Réponse sous 24 h",
            "included": ["Entretien de cadrage", "Texte relu et corrigé", "Une série de retouches"],
        },
    ),
    dict(
        title="Retouche photo professionnelle", type=S, price=15, old=None, mode=PriceMode.STARTING_AT,
        cat="Photo & image", featured=False, days=18,
        description="Colorimétrie, nettoyage, détourage. Tarif à partir de 15 € par photo, dégressif dès dix photos.",
        attributes={
            "duration": "24 à 72 h", "provider_name": "Studio Mira", "availability": "Disponible cette semaine",
            "included": ["Correction des couleurs", "Nettoyage des défauts", "Export haute définition"],
        },
    ),
    dict(
        title="Séance photo portrait", type=B, price=50, old=None, cat="Photo & image",
        featured=True, days=4,
        description="Une heure en studio ou en extérieur, vingt images retouchées livrées en galerie privée sous une semaine.",
        attributes={
            "duration_minutes": 60, "location": "Studio du centre-ville", "provider_name": "Studio Mira",
            "included": ["1 heure de séance", "20 images retouchées", "Galerie privée en ligne"],
        },
        slots=dict(hours=(8, 10, 13, 15), capacity=1, minutes=60),
    ),
    dict(
        title="Consultation conseil en stratégie", type=B, price=40, old=None, cat="Cours & conseil",
        featured=False, days=10,
        description="Quarante-cinq minutes pour clarifier une offre, un prix ou un plan d'action, avec un compte rendu écrit.",
        attributes={
            "duration_minutes": 45, "location": "En visioconférence", "provider_name": "Cabinet Voly",
            "included": ["45 minutes d'échange", "Compte rendu écrit"],
        },
        slots=dict(hours=(9, 11, 14), capacity=1, minutes=45),
    ),
    dict(
        title="Cours particulier de mathématiques", type=B, price=25, old=None, cat="Cours & conseil",
        featured=False, days=14,
        description="Une heure de cours individuel, du collège à la licence, avec exercices corrigés envoyés après la séance.",
        attributes={
            "duration_minutes": 60, "location": "À domicile ou en visioconférence", "provider_name": "Hery A.",
            "included": ["1 heure de cours", "Exercices corrigés"],
        },
        slots=dict(hours=(8, 10, 12, 14, 16), capacity=1, minutes=60),
    ),
    dict(
        title="Atelier découverte de la reliure", type=B, price=35, old=45, cat="Papeterie",
        featured=False, days=1,
        description="Un atelier de quatre-vingt-dix minutes en petit groupe : vous repartez avec le carnet que vous avez cousu.",
        attributes={
            "duration_minutes": 90, "location": "Atelier Papier, centre-ville", "provider_name": "Atelier Papier",
            "included": ["Matériel fourni", "Un carnet à emporter"],
        },
        slots=dict(hours=(14,), capacity=6, minutes=90, days_step=3),
    ),
]

REVIEWERS = ["Fanja R.", "Hery A.", "Lalaina M.", "Miora T.", "Tiana R.", "Voahangy S."]
REVIEWS = {
    "Casque audio sans fil Nomade": [
        (5, "Très confortable, l'autonomie tient vraiment la promesse."),
        (4, "Bon son, la réduction de bruit est efficace dans les transports."),
    ],
    "Sac à dos en toile cirée": [(5, "Robuste et joli, il a déjà résisté à une grosse pluie.")],
    "Hub USB-C 7 ports": [(4, "Fait le travail, chauffe un peu en charge.")],
    "Pack de 120 icônes SVG": [(5, "Cohérent et propre, gain de temps énorme."), (5, "Bien organisé, licence claire.")],
    "Création de logo": [
        (5, "Trois pistes vraiment différentes, et une écoute attentive."),
        (5, "Livraison dans les temps, fichiers impeccables."),
        (4, "Très bon résultat, j'aurais aimé une série de retouches de plus."),
    ],
    "Site web vitrine": [(5, "Rapide, lisible sur mon téléphone, exactement ce que je voulais.")],
    "Retouche photo professionnelle": [(5, "Des photos de produits transformées, merci.")],
    "Séance photo portrait": [
        (5, "À l'aise dès la première minute, images superbes."),
        (4, "Belle séance, galerie livrée avant la date annoncée."),
    ],
    "Consultation conseil en stratégie": [(5, "Des conseils concrets et un compte rendu utile.")],
    "Cours particulier de mathématiques": [(5, "Explications claires, mon fils a repris confiance.")],
    "Atelier découverte de la reliure": [(5, "Ambiance chaleureuse, je suis reparti avec mon carnet !")],
}


def _password(env_name: str, label: str, generated: dict[str, str]) -> str:
    value = os.environ.get(env_name)
    if not value:
        value = secrets.token_urlsafe(9)
        generated[label] = value
    return value


def reset(db: Session) -> None:
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(table.delete())
    db.commit()


def make_slots(db: Session, offer: Offer, cfg: dict) -> None:
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    step = cfg.get("days_step", 1)
    for day in range(1, 22, step):
        date = now + timedelta(days=day)
        if date.weekday() >= 5:  # pas de créneaux le week-end
            continue
        for hour in cfg["hours"]:
            start = date.replace(hour=hour)
            db.add(
                BookingSlot(
                    offer_id=offer.id,
                    starts_at=start,
                    ends_at=start + timedelta(minutes=cfg["minutes"]),
                    capacity=cfg["capacity"],
                )
            )


def seed(db: Session) -> dict[str, str]:
    generated: dict[str, str] = {}
    if db.scalar(select(func.count(Offer.id))):
        print("La base contient déjà des offres : rien n'a été modifié (utilise --reset pour repartir de zéro).")
        return generated

    admin_email = os.environ.get("SEED_ADMIN_EMAIL", "admin@example.com")
    demo_email = os.environ.get("SEED_DEMO_EMAIL", "demo@example.com")
    admin = db.scalar(select(User).where(User.email == admin_email)) or User(
        email=admin_email,
        hashed_password=hash_password(_password("SEED_ADMIN_PASSWORD", admin_email, generated)),
        full_name="Administrateur Comptoir",
        role=UserRole.ADMIN,
    )
    demo = db.scalar(select(User).where(User.email == demo_email)) or User(
        email=demo_email,
        hashed_password=hash_password(_password("SEED_DEMO_PASSWORD", demo_email, generated)),
        full_name="Utilisateur Démo",
        role=UserRole.USER,
    )
    db.add_all([admin, demo])

    reviewers = []
    for i, name in enumerate(REVIEWERS):
        user = User(
            email=f"client{i + 1}@example.com",
            hashed_password=hash_password(secrets.token_urlsafe(24)),  # compte non utilisable
            full_name=name,
            role=UserRole.USER,
        )
        reviewers.append(user)
    db.add_all(reviewers)

    categories = {}
    for name, position in CATEGORIES:
        cat = Category(name=name, slug=slugify(name), position=position, applies_to=[])
        db.add(cat)
        categories[name] = cat
    db.flush()

    now = datetime.now(timezone.utc)
    offers: dict[str, Offer] = {}
    for spec in OFFERS:
        offer = Offer(
            title=spec["title"],
            slug=slugify(spec["title"]),
            description=spec["description"],
            offer_type=spec["type"],
            price=spec["price"],
            old_price=spec["old"],
            price_mode=spec.get("mode", PriceMode.FIXED),
            category_id=categories[spec["cat"]].id,
            owner_id=admin.id,
            attributes=spec["attributes"],
            is_active=True,
            is_featured=spec["featured"],
            published_at=now - timedelta(days=spec["days"]),
        )
        if "physical" in spec:
            offer.physical = PhysicalDetails(**spec["physical"])
        db.add(offer)
        db.flush()
        if "slots" in spec:
            make_slots(db, offer, spec["slots"])
        offers[offer.title] = offer

    for title, items in REVIEWS.items():
        for i, (rating, comment) in enumerate(items):
            db.add(
                Review(
                    user_id=reviewers[(len(title) + i * 2) % len(reviewers)].id,
                    offer_id=offers[title].id,
                    rating=rating,
                    comment=comment,
                    created_at=now - timedelta(days=i * 3 + 1),
                )
            )
    db.flush()
    for offer in offers.values():
        refresh_rating(db, offer.id)
    db.commit()
    print(f"{len(offers)} offres, {len(categories)} catégories, {len(REVIEWS)} offres avec avis créées.")
    return generated


def main() -> None:
    if "--create-tables" in sys.argv:  # pratique pour un essai rapide sans Alembic
        Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        if "--reset" in sys.argv:
            reset(db)
        generated = seed(db)
    if generated:
        print("\nComptes créés (note ces mots de passe, ils ne seront plus affichés) :")
        for email, password in generated.items():
            print(f"  {email}  /  {password}")


if __name__ == "__main__":
    main()
