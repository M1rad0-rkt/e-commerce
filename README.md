# Comptoir

Plateforme de découverte et de vente d'**offres** : produits physiques, services, produits numériques et réservations, avec un seul modèle de données (`Offer`) et une expérience cohérente.

> État : étapes 1 à 5 terminées (architecture, direction artistique, structure du projet, base de données, modèle `Offer`). L'API, les pages et l'administration arrivent aux étapes suivantes. Voir [ARCHITECTURE.md](./ARCHITECTURE.md).

## Technologies

- Backend : FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic, PostgreSQL 16, Uvicorn
- Frontend : React 19, Vite, TypeScript, React Router, TanStack Query, Tailwind CSS v4
- Infra : Docker Compose

## Structure

```text
comptoir/
├── backend/        API FastAPI (app/, alembic/, tests/)
├── frontend/       Application React (src/)
├── docker-compose.yml
├── .env.example    variables pour Docker Compose
└── ARCHITECTURE.md architecture + direction artistique
```

## Option A : tout lancer avec Docker (le plus simple)

Prérequis : Docker Desktop. Dans PowerShell, à la racine du projet :

```powershell
copy .env.example .env
```

Ouvre `.env` et renseigne `POSTGRES_PASSWORD` et `SECRET_KEY`. Pour générer une clé :

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Puis :

```powershell
docker compose up --build
```

- Frontend : http://localhost:5173
- API : http://localhost:8000 (documentation : http://localhost:8000/docs)
- Test : http://localhost:8000/api/health

Les migrations sont appliquées automatiquement au démarrage du backend.

## Option B : lancement local

### 1. PostgreSQL

Soit une installation locale de PostgreSQL, soit seulement la base via Docker :

```powershell
docker compose up -d db
```

(après avoir créé `.env` comme ci-dessus).

### 2. Backend

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Dans `backend\.env`, remplace `CHANGE_ME` dans `DATABASE_URL` par le mot de passe PostgreSQL et renseigne `SECRET_KEY`.

> Si PowerShell refuse d'activer l'environnement : `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

Migrations puis serveur :

```powershell
alembic upgrade head
uvicorn app.main:app --reload
```

### 3. Frontend

Prérequis : Node.js 20 ou plus.

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

## Migrations Alembic

```powershell
# après avoir modifié un modèle
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic downgrade -1     # annuler la dernière
```

Relis toujours la migration générée avant de l'appliquer.

## Configuration

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | connexion PostgreSQL (`postgresql+psycopg2://...`) |
| `SECRET_KEY` | signature des JWT (obligatoire, jamais dans le code) |
| `CORS_ORIGINS` | origines autorisées, séparées par des virgules |
| `API_URL` | URL publique de l'API |
| `VITE_API_URL` | URL de l'API utilisée par le frontend |

## À venir

API (étape 7), données de démonstration (étape 6), pages (étapes 8 à 11), authentification et espace utilisateur (12), administration (13).
