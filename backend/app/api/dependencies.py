"""Dépendances FastAPI partagées : session DB, utilisateur courant, rôles."""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models import User, UserRole

bearer = HTTPBearer(auto_error=False)


def _user_from_credentials(
    creds: HTTPAuthorizationCredentials | None, db: Session
) -> User | None:
    if creds is None:
        return None
    try:
        payload = decode_token(creds.credentials, "access")
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError):
        return None
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        return None
    return user


def get_current_user_optional(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User | None:
    return _user_from_credentials(creds, db)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    user = _user_from_credentials(creds, db)
    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Authentification requise ou session expirée.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Accès réservé aux administrateurs.")
    return user


__all__ = ["get_db", "get_current_user", "get_current_user_optional", "require_admin"]
