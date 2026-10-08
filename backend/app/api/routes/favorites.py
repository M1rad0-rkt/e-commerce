from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, get_db
from app.models import Favorite, Offer, User
from app.schemas.offer import OfferOut
from app.services.offers import get_offer_by_ref, serialize_offers, _eager

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=list[OfferOut])
def list_favorites(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    offers = db.scalars(
        select(Offer)
        .join(Favorite, Favorite.offer_id == Offer.id)
        .where(Favorite.user_id == user.id, Offer.is_active.is_(True))
        .options(*_eager())
        .order_by(Favorite.created_at.desc())
    ).all()
    return serialize_offers(db, list(offers))


@router.get("/ids", response_model=list[int])
def favorite_ids(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list(db.scalars(select(Favorite.offer_id).where(Favorite.user_id == user.id)))


@router.post("/{offer_id}", status_code=status.HTTP_204_NO_CONTENT)
def add_favorite(
    offer_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    offer = get_offer_by_ref(db, str(offer_id))
    if db.get(Favorite, (user.id, offer.id)) is None:
        db.add(Favorite(user_id=user.id, offer_id=offer.id))
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{offer_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    offer_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    favorite = db.get(Favorite, (user.id, offer_id))
    if favorite is not None:
        db.delete(favorite)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
