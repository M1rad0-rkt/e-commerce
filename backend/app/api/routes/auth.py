import logging
from datetime import timedelta

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.core.config import settings
from app.services.notifications import notify_admins
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_token,
    decode_token,
    hash_password,
    password_fingerprint,
    verify_password,
)
from app.models import User, UserRole
from app.schemas.common import Message
from app.schemas.user import (
    AuthOut,
    ForgotPasswordIn,
    LoginIn,
    RefreshIn,
    RegisterIn,
    ResetPasswordIn,
    UserOut,
)

logger = logging.getLogger("comptoir.auth")
router = APIRouter(prefix="/auth", tags=["auth"])

_INVALID = HTTPException(status.HTTP_401_UNAUTHORIZED, "E-mail ou mot de passe incorrect.")
_dummy_hash: str | None = None


def _auth_out(user: User) -> AuthOut:
    return AuthOut(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=AuthOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    if db.scalar(select(User.id).where(User.email == payload.email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Un compte existe déjà avec cet e-mail.")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role=UserRole.USER,
    )
    db.add(user)
    try:
        db.flush()
        notify_admins(db, "user_new", "Nouvel utilisateur", f"{user.full_name} · {user.email}", "/admin/utilisateurs")
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Un compte existe déjà avec cet e-mail.")
    db.refresh(user)
    return _auth_out(user)


@router.post("/login", response_model=AuthOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    global _dummy_hash
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None:
        # Même durée de calcul qu'un vrai test pour ne pas révéler quels e-mails existent.
        _dummy_hash = _dummy_hash or hash_password("dummy-password")
        verify_password(payload.password, _dummy_hash)
        raise _INVALID
    if not verify_password(payload.password, user.hashed_password):
        raise _INVALID
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ce compte est désactivé.")
    return _auth_out(user)


@router.post("/refresh", response_model=AuthOut)
def refresh(payload: RefreshIn, db: Session = Depends(get_db)):
    try:
        data = decode_token(payload.refresh_token, "refresh")
        user = db.get(User, int(data["sub"]))
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expirée, reconnecte-toi.")
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expirée, reconnecte-toi.")
    return _auth_out(user)


@router.post("/forgot-password", response_model=Message)
def forgot_password(payload: ForgotPasswordIn, db: Session = Depends(get_db)):
    """Réponse identique que le compte existe ou non (pas de fuite d'information)."""
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is not None and user.is_active:
        token = create_token(
            user.id,
            "reset",
            timedelta(minutes=settings.reset_token_expire_minutes),
            {"pwd": password_fingerprint(user.hashed_password)},
        )
        if settings.log_reset_links:
            logger.warning(
                "Lien de réinitialisation (mode développement) : %s/reinitialiser-mot-de-passe?token=%s",
                settings.frontend_url,
                token,
            )
    return Message(
        detail="Si un compte correspond à cet e-mail, un lien de réinitialisation a été préparé."
    )


@router.post("/reset-password", response_model=Message)
def reset_password(payload: ResetPasswordIn, db: Session = Depends(get_db)):
    bad = HTTPException(status.HTTP_400_BAD_REQUEST, "Lien invalide ou expiré.")
    try:
        data = decode_token(payload.token, "reset")
        user = db.get(User, int(data["sub"]))
    except (jwt.PyJWTError, ValueError, KeyError):
        raise bad
    # Le jeton n'est valable que tant que le mot de passe n'a pas changé (usage unique).
    if user is None or data.get("pwd") != password_fingerprint(user.hashed_password):
        raise bad
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return Message(detail="Mot de passe mis à jour. Tu peux te connecter.")
