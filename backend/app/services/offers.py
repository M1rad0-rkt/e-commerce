"""Recherche, filtres, tri et sérialisation des offres."""

from dataclasses import dataclass, field
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import and_, case, exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    BookingSlot,
    Category,
    Offer,
    OfferType,
    PhysicalDetails,
    Review,
)
from app.schemas.common import total_pages
from app.schemas.offer import FacetValue, OfferFacets, OfferOut, OfferPage
from app.services.offer_types import get_capabilities, get_primary_action

SORTS = ("relevance", "newest", "price_asc", "price_desc", "rating", "popular")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_aware(dt: datetime) -> datetime:
    """SQLite renvoie des dates naïves (UTC) ; PostgreSQL des dates avec fuseau."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@dataclass
class OfferFilters:
    q: str | None = None
    types: list[OfferType] = field(default_factory=list)
    category: str | None = None
    min_price: float | None = None
    max_price: float | None = None
    in_stock: bool = False
    min_rating: float | None = None
    promo: bool = False
    featured: bool = False
    # True = offres publiées uniquement ; None = toutes (administration)
    active: bool | None = True


def _like(q: str) -> str:
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _availability_condition():
    now = utcnow()
    physical_ok = and_(
        Offer.offer_type == OfferType.PHYSICAL_PRODUCT,
        exists().where(PhysicalDetails.offer_id == Offer.id, PhysicalDetails.stock > 0),
    )
    booking_ok = and_(
        Offer.offer_type == OfferType.BOOKING,
        exists().where(
            BookingSlot.offer_id == Offer.id,
            BookingSlot.starts_at > now,
            BookingSlot.booked_count < BookingSlot.capacity,
        ),
    )
    other_ok = Offer.offer_type.in_([OfferType.SERVICE, OfferType.DIGITAL_PRODUCT])
    return or_(other_ok, physical_ok, booking_ok)


def _base_conditions(f: OfferFilters) -> list:
    conds = []
    if f.active is not None:
        conds.append(Offer.is_active.is_(f.active))
    if f.q:
        pattern = _like(f.q.strip())
        conds.append(
            or_(
                Offer.title.ilike(pattern, escape="\\"),
                Offer.description.ilike(pattern, escape="\\"),
                Category.name.ilike(pattern, escape="\\"),
            )
        )
    if f.min_price is not None:
        conds.append(Offer.price >= f.min_price)
    if f.max_price is not None:
        conds.append(Offer.price <= f.max_price)
    if f.min_rating:
        conds.append(Offer.rating_avg >= f.min_rating)
    if f.promo:
        conds.append(
            and_(
                Offer.old_price.is_not(None),
                Offer.price.is_not(None),
                Offer.old_price > Offer.price,
            )
        )
    if f.featured:
        conds.append(Offer.is_featured.is_(True))
    if f.in_stock:
        conds.append(_availability_condition())
    return conds


def _category_ids(db: Session, slug: str) -> list[int]:
    """Catégorie demandée + ses sous-catégories."""
    rows = db.execute(
        select(Category.id).where(
            or_(
                Category.slug == slug,
                Category.parent_id.in_(select(Category.id).where(Category.slug == slug)),
            )
        )
    ).all()
    return [r[0] for r in rows]


def _order_by(sort: str, q: str | None) -> list:
    if sort == "newest":
        return [Offer.published_at.desc().nulls_last(), Offer.id.desc()]
    if sort == "price_asc":
        return [Offer.price.asc().nulls_last(), Offer.id.asc()]
    if sort == "price_desc":
        return [Offer.price.desc().nulls_last(), Offer.id.asc()]
    if sort == "rating":
        return [Offer.rating_avg.desc(), Offer.rating_count.desc(), Offer.id.asc()]
    if sort == "popular":
        return [Offer.rating_count.desc(), Offer.rating_avg.desc(), Offer.id.asc()]
    if q:
        pattern = _like(q.strip())
        rank = case(
            (Offer.title.ilike(pattern.replace("%", "", 1), escape="\\"), 0),
            (Offer.title.ilike(pattern, escape="\\"), 1),
            else_=2,
        )
        return [rank, Offer.is_featured.desc(), Offer.rating_count.desc(), Offer.id.asc()]
    return [Offer.is_featured.desc(), Offer.rating_count.desc(), Offer.id.desc()]


def next_slots(db: Session, offer_ids: list[int]) -> dict[int, datetime]:
    if not offer_ids:
        return {}
    rows = db.execute(
        select(BookingSlot.offer_id, func.min(BookingSlot.starts_at))
        .where(
            BookingSlot.offer_id.in_(offer_ids),
            BookingSlot.starts_at > utcnow(),
            BookingSlot.booked_count < BookingSlot.capacity,
        )
        .group_by(BookingSlot.offer_id)
    ).all()
    return {oid: dt for oid, dt in rows}


def serialize_offer(offer: Offer, next_slot: datetime | None = None) -> OfferOut:
    stock = offer.physical.stock if offer.physical else None
    if offer.offer_type == OfferType.PHYSICAL_PRODUCT:
        in_stock = (stock or 0) > 0
    elif offer.offer_type == OfferType.BOOKING:
        in_stock = next_slot is not None
    else:
        in_stock = True
    return OfferOut.model_validate(
        {
            "id": offer.id,
            "title": offer.title,
            "slug": offer.slug,
            "description": offer.description,
            "offer_type": offer.offer_type,
            "price": float(offer.price) if offer.price is not None else None,
            "old_price": float(offer.old_price) if offer.old_price is not None else None,
            "price_mode": offer.price_mode,
            "currency": offer.currency,
            "category": offer.category,
            "owner": offer.owner,
            "image": offer.image,
            "gallery": offer.gallery or [],
            "attributes": offer.attributes or {},
            "rating_avg": float(offer.rating_avg or 0),
            "rating_count": offer.rating_count or 0,
            "is_active": offer.is_active,
            "is_featured": offer.is_featured,
            "published_at": offer.published_at,
            "created_at": offer.created_at,
            "capabilities": get_capabilities(offer.offer_type),
            "primary_action": get_primary_action(offer.offer_type, offer.price_mode),
            "in_stock": in_stock,
            "stock": stock,
            "next_slot_at": next_slot,
            "physical": offer.physical,
        },
        from_attributes=True,
    )


def serialize_offers(db: Session, offers: list[Offer]) -> list[OfferOut]:
    booking_ids = [o.id for o in offers if o.offer_type == OfferType.BOOKING]
    slots = next_slots(db, booking_ids)
    return [serialize_offer(o, slots.get(o.id)) for o in offers]


def _eager():
    return (
        selectinload(Offer.category),
        selectinload(Offer.owner),
        selectinload(Offer.physical),
    )


def search_offers(
    db: Session, f: OfferFilters, sort: str, page: int, page_size: int
) -> OfferPage:
    conds = _base_conditions(f)
    cat_ids = _category_ids(db, f.category) if f.category else None
    type_cond = Offer.offer_type.in_(f.types) if f.types else None
    cat_cond = Offer.category_id.in_(cat_ids or [-1]) if f.category else None

    def joined(stmt):
        return stmt.select_from(Offer).outerjoin(Category, Offer.category_id == Category.id)

    all_conds = [*conds, *(c for c in (type_cond, cat_cond) if c is not None)]
    total = db.scalar(joined(select(func.count(Offer.id))).where(*all_conds)) or 0

    stmt = (
        joined(select(Offer))
        .where(*all_conds)
        .options(*_eager())
        .order_by(*_order_by(sort, f.q))
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    offers = list(db.scalars(stmt).unique().all())

    # Facettes : chaque dimension ignore son propre filtre pour proposer des alternatives.
    type_rows = db.execute(
        joined(select(Offer.offer_type, func.count(Offer.id)))
        .where(*conds, *([cat_cond] if cat_cond is not None else []))
        .group_by(Offer.offer_type)
    ).all()
    cat_rows = db.execute(
        joined(select(Category.id, Category.name, Category.slug, func.count(Offer.id)))
        .where(*conds, *([type_cond] if type_cond is not None else []))
        .where(Offer.category_id.is_not(None))
        .group_by(Category.id, Category.name, Category.slug)
        .order_by(Category.name)
    ).all()
    pmin, pmax = db.execute(
        joined(select(func.min(Offer.price), func.max(Offer.price))).where(*conds)
    ).one()

    facets = OfferFacets(
        types=[FacetValue(value=t.value, count=c) for t, c in type_rows],
        categories=[
            FacetValue(value=slug, label=name, count=c) for _id, name, slug, c in cat_rows
        ],
        price_min=float(pmin) if pmin is not None else None,
        price_max=float(pmax) if pmax is not None else None,
    )
    return OfferPage(
        items=serialize_offers(db, offers),
        total=total,
        page=page,
        page_size=page_size,
        pages=total_pages(total, page_size),
        facets=facets,
    )


def get_offer_by_ref(db: Session, ref: str, only_active: bool = True) -> Offer:
    """Une référence est un identifiant numérique ou un slug."""
    stmt = select(Offer).options(*_eager())
    stmt = stmt.where(Offer.id == int(ref)) if ref.isdigit() else stmt.where(Offer.slug == ref)
    if only_active:
        stmt = stmt.where(Offer.is_active.is_(True))
    offer = db.scalars(stmt).first()
    if offer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Offre introuvable.")
    return offer


def refresh_rating(db: Session, offer_id: int) -> None:
    avg, count = db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(Review.offer_id == offer_id)
    ).one()
    offer = db.get(Offer, offer_id)
    if offer is not None:
        offer.rating_avg = round(float(avg or 0), 2)
        offer.rating_count = int(count or 0)
