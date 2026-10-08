from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user, get_db
from app.models import BookingSlot, Category, Offer, OfferType, Review, User
from app.schemas.common import Page, total_pages
from app.schemas.offer import (
    CategoryOut,
    OfferOut,
    OfferPage,
    ReviewIn,
    ReviewOut,
    SlotOut,
)
from app.services.offers import (
    OfferFilters,
    get_offer_by_ref,
    refresh_rating,
    search_offers,
    serialize_offer,
    utcnow,
)
from app.services.reviews import review_out

router = APIRouter(tags=["offers"])

SortParam = Literal["relevance", "newest", "price_asc", "price_desc", "rating", "popular"]


@router.get("/offers", response_model=OfferPage)
def list_offers(
    q: str | None = Query(default=None, max_length=100),
    types: list[OfferType] = Query(default=[], alias="type"),
    category: str | None = Query(default=None, max_length=120),
    min_price: float | None = Query(default=None, ge=0),
    max_price: float | None = Query(default=None, ge=0),
    in_stock: bool = False,
    min_rating: float | None = Query(default=None, ge=0, le=5),
    promo: bool = False,
    featured: bool = False,
    sort: SortParam = "relevance",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=12, ge=1, le=48),
    db: Session = Depends(get_db),
):
    filters = OfferFilters(
        q=q,
        types=types,
        category=category,
        min_price=min_price,
        max_price=max_price,
        in_stock=in_stock,
        min_rating=min_rating,
        promo=promo,
        featured=featured,
    )
    return search_offers(db, filters, sort, page, page_size)


@router.get("/offers/{ref}", response_model=OfferOut)
def get_offer(ref: str, db: Session = Depends(get_db)):
    """`ref` : identifiant numérique ou slug."""
    offer = get_offer_by_ref(db, ref)
    slot = db.scalar(
        select(func.min(BookingSlot.starts_at)).where(
            BookingSlot.offer_id == offer.id,
            BookingSlot.starts_at > utcnow(),
            BookingSlot.booked_count < BookingSlot.capacity,
        )
    )
    return serialize_offer(offer, slot)


@router.get("/offers/{offer_id}/slots", response_model=list[SlotOut])
def offer_slots(offer_id: int, db: Session = Depends(get_db)):
    offer = get_offer_by_ref(db, str(offer_id))
    if offer.offer_type != OfferType.BOOKING:
        return []
    slots = db.scalars(
        select(BookingSlot)
        .where(BookingSlot.offer_id == offer.id, BookingSlot.starts_at > utcnow())
        .order_by(BookingSlot.starts_at)
    ).all()
    out = []
    for s in slots:
        item = SlotOut.model_validate(s)
        item.remaining = max(0, s.capacity - s.booked_count)
        out.append(item)
    return out


# --- Avis -----------------------------------------------------------------


@router.get("/offers/{offer_id}/reviews", response_model=Page[ReviewOut])
def offer_reviews(
    offer_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    offer = get_offer_by_ref(db, str(offer_id))
    total = db.scalar(select(func.count(Review.id)).where(Review.offer_id == offer.id)) or 0
    rows = db.scalars(
        select(Review)
        .where(Review.offer_id == offer.id)
        .options(selectinload(Review.user))
        .order_by(Review.created_at.desc(), Review.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    return Page[ReviewOut](
        items=[review_out(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=total_pages(total, page_size),
    )


@router.post("/offers/{offer_id}/reviews", response_model=ReviewOut)
def upsert_review(
    offer_id: int,
    payload: ReviewIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Un seul avis par personne et par offre : un nouvel envoi remplace l'ancien."""
    offer = get_offer_by_ref(db, str(offer_id))
    review = db.scalar(
        select(Review).where(Review.user_id == user.id, Review.offer_id == offer.id)
    )
    if review is None:
        review = Review(user_id=user.id, offer_id=offer.id, rating=payload.rating, comment=payload.comment.strip())
        db.add(review)
    else:
        review.rating = payload.rating
        review.comment = payload.comment.strip()
    db.flush()
    refresh_rating(db, offer.id)
    db.commit()
    db.refresh(review)
    return review_out(review)


@router.get("/reviews/recent", response_model=list[ReviewOut])
def recent_reviews(
    limit: int = Query(default=6, ge=1, le=20),
    min_rating: int = Query(default=4, ge=1, le=5),
    db: Session = Depends(get_db),
):
    rows = db.scalars(
        select(Review)
        .join(Offer, Offer.id == Review.offer_id)
        .where(Offer.is_active.is_(True), Review.rating >= min_rating, Review.comment != "")
        .options(selectinload(Review.user), selectinload(Review.offer))
        .order_by(Review.created_at.desc(), Review.id.desc())
        .limit(limit)
    ).all()
    return [review_out(r, with_offer=True) for r in rows]


@router.delete("/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    review = db.get(Review, review_id)
    if review is None or review.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Avis introuvable.")
    offer_id = review.offer_id
    db.delete(review)
    db.flush()
    refresh_rating(db, offer_id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Catégories -----------------------------------------------------------


def category_counts(db: Session) -> dict[int, int]:
    rows = db.execute(
        select(Offer.category_id, func.count(Offer.id))
        .where(Offer.is_active.is_(True), Offer.category_id.is_not(None))
        .group_by(Offer.category_id)
    ).all()
    return {cid: n for cid, n in rows}


def category_out(c: Category, counts: dict[int, int]) -> CategoryOut:
    return CategoryOut(
        id=c.id,
        name=c.name,
        slug=c.slug,
        parent_id=c.parent_id,
        applies_to=list(c.applies_to or []),
        position=c.position,
        is_active=c.is_active,
        offer_count=counts.get(c.id, 0),
    )


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    counts = category_counts(db)
    rows = db.scalars(
        select(Category).where(Category.is_active.is_(True)).order_by(Category.position, Category.name)
    ).all()
    return [category_out(c, counts) for c in rows]


@router.get("/categories/{category_id}", response_model=CategoryOut)
def get_category(category_id: int, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if category is None or not category.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Catégorie introuvable.")
    return category_out(category, category_counts(db))
