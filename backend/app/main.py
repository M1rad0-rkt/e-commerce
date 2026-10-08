from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import admin, auth, favorites, notifications, offers, orders, users
from app.core.config import settings

app = FastAPI(
    title=f"{settings.app_name} API",
    version="1.0.0",
    description="API de la plateforme d'offres : produits, services, numérique, réservations.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


@api.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "app": settings.app_name}


api.include_router(auth.router)
api.include_router(users.router)
api.include_router(offers.router)
api.include_router(favorites.router)
api.include_router(orders.router)
api.include_router(notifications.router)
api.include_router(admin.router)
app.include_router(api)
