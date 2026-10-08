from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user, get_db
from app.core.security import hash_password, verify_password
from app.models import Address, Review, User
from app.schemas.common import Message
from app.schemas.offer import ReviewOut
from app.schemas.user import AddressIn, AddressOut, PasswordChange, ProfileUpdate, UserOut
from app.services.reviews import review_out

router = APIRouter(prefix="/users/me", tags=["users"])


@router.get("", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.patch("", response_model=UserOut)
def update_me(
    payload: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if payload.email and payload.email != user.email:
        if db.scalar(select(User.id).where(User.email == payload.email)):
            raise HTTPException(status.HTTP_409_CONFLICT, "Cet e-mail est déjà utilisé.")
        user.email = payload.email
    if payload.full_name:
        user.full_name = payload.full_name.strip()
    db.commit()
    db.refresh(user)
    return user


@router.post("/password", response_model=Message)
def change_password(
    payload: PasswordChange, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mot de passe actuel incorrect.")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return Message(detail="Mot de passe modifié.")


# --- Adresses -------------------------------------------------------------


def _own_address(db: Session, user: User, address_id: int) -> Address:
    address = db.get(Address, address_id)
    if address is None or address.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Adresse introuvable.")
    return address


def _clear_default(db: Session, user: User, keep_id: int | None = None) -> None:
    stmt = update(Address).where(Address.user_id == user.id)
    if keep_id is not None:
        stmt = stmt.where(Address.id != keep_id)
    db.execute(stmt.values(is_default=False))


@router.get("/addresses", response_model=list[AddressOut])
def list_addresses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Address).where(Address.user_id == user.id).order_by(Address.is_default.desc(), Address.id)
    ).all()


@router.post("/addresses", response_model=AddressOut, status_code=status.HTTP_201_CREATED)
def create_address(
    payload: AddressIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    has_any = db.scalar(select(Address.id).where(Address.user_id == user.id)) is not None
    address = Address(user_id=user.id, **payload.model_dump())
    if not has_any:
        address.is_default = True
    db.add(address)
    db.flush()
    if address.is_default:
        _clear_default(db, user, keep_id=address.id)
    db.commit()
    db.refresh(address)
    return address


@router.put("/addresses/{address_id}", response_model=AddressOut)
def update_address(
    address_id: int,
    payload: AddressIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    address = _own_address(db, user, address_id)
    for key, value in payload.model_dump().items():
        setattr(address, key, value)
    if address.is_default:
        _clear_default(db, user, keep_id=address.id)
    db.commit()
    db.refresh(address)
    return address


@router.delete("/addresses/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(
    address_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    db.delete(_own_address(db, user, address_id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Avis -----------------------------------------------------------------


@router.get("/reviews", response_model=list[ReviewOut])
def my_reviews(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Review)
        .where(Review.user_id == user.id)
        .options(selectinload(Review.offer), selectinload(Review.user))
        .order_by(Review.created_at.desc(), Review.id.desc())
    ).all()
    return [review_out(r, with_offer=True) for r in rows]
