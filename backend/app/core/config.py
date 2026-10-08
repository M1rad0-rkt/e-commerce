from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Comptoir"
    database_url: str
    secret_key: str
    cors_origins: str = "http://localhost:5173"
    api_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:5173"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    reset_token_expire_minutes: int = 30
    password_hash_iterations: int = 390_000
    # En développement, le lien de récupération de compte est affiché dans la console
    # du serveur (pas d'envoi d'e-mail). À désactiver quand un vrai envoi sera branché.
    log_reset_links: bool = True

    @field_validator("secret_key")
    @classmethod
    def secret_key_is_strong(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError(
                "SECRET_KEY doit faire au moins 32 caractères. Génère-en une avec : "
                'python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        return v

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
