"""Administration : offres, créneaux, catégories, commandes, réservations, utilisateurs, devis."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_db, require_admin
from app.api.routes.offers import category_counts, category_out
from app.models import (
    Booking,
    BookingSlot,
    BookingStatus,
    Category,
    Offer,
    OfferType,
    Order,
    OrderItem,
    OrderStatus,
    PaymentStatus,
    PhysicalDetails,
    PriceMode,
    QuoteRequest,
    QuoteStatus,
    User,
)
from app.schemas.common import Page, total_pages
from app.schemas.offer import (
    CategoryIn,
    CategoryOut,
    OfferCreate,
    OfferOut,
    OfferPage,
    OfferStatusIn,
    OfferUpdate,
    SlotIn,
    SlotOut,
)
from app.schemas.order import (
    AdminOrderOut,
    BookingOut,
    BookingStatusIn,
    OrderStatusIn,
    QuoteOut,
    QuoteStatusIn,
)
from app.schemas.user import AdminUserUpdate, UserOut
from app.services.offers import (
    OfferFilters,
    get_offer_by_ref,
    search_offers,
    serialize_offer,
    utcnow,
)
from app.services.orders import (
    order_query,
    serialize_admin_order,
    serialize_booking,
    serialize_quote,
    set_booking_status,
    set_order_status,
)
from app.services.notifications import BOOKING_LABEL, QUOTE_LABEL, notify
from app.services.slugs import unique_slug

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# --- Offres ---------------------------------------------------------------


@router.get("/offers", response_model=OfferPage)
def admin_list_offers(
    q: str | None = Query(default=None, max_length=100),
    types: list[OfferType] = Query(default=[], alias="type"),
    state: Literal["all", "published", "draft"] = "all",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    active = {"all": None, "published": True, "draft": False}[state]
    filters = OfferFilters(q=q, types=types, active=active)
    return search_offers(db, filters, "newest", page, page_size)


@router.get("/offers/{offer_id}", response_model=OfferOut)
def admin_get_offer(offer_id: int, db: Session = Depends(get_db)):
    return serialize_offer(get_offer_by_ref(db, str(offer_id), only_active=False))


def _check_category(db: Session, category_id: int | None) -> None:
    if category_id is not None and db.get(Category, category_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Catégorie inconnue.")


@router.post("/offers", response_model=OfferOut, status_code=status.HTTP_201_CREATED)
def admin_create_offer(
    payload: OfferCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    _check_category(db, payload.category_id)
    data = payload.model_dump(exclude={"physical"})
    offer = Offer(**data, slug=unique_slug(db, Offer, payload.title), owner_id=admin.id)
    if offer.is_active:
        offer.published_at = utcnow()
    if payload.offer_type == OfferType.PHYSICAL_PRODUCT:
        phys = payload.physical.model_dump() if payload.physical else {}
        offer.physical = PhysicalDetails(**phys)
    db.add(offer)
    db.commit()
    return serialize_offer(get_offer_by_ref(db, str(offer.id), only_active=False))


@router.put("/offers/{offer_id}", response_model=OfferOut)
def admin_update_offer(offer_id: int, payload: OfferUpdate, db: Session = Depends(get_db)):
    offer = get_offer_by_ref(db, str(offer_id), only_active=False)
    changes = payload.model_dump(exclude_unset=True)
    physical = changes.pop("physical", None)
    if "category_id" in changes:
        _check_category(db, changes["category_id"])
    for key, value in changes.items():
        if key in ("title", "price_mode", "offer_type", "currency") and value is None:
            continue  # ces champs ne peuvent pas être vidés
        setattr(offer, key, value)
    if offer.price_mode != PriceMode.QUOTE and offer.price is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Le prix est obligatoire (sauf pour une offre sur devis).",
        )
    if offer.offer_type == OfferType.PHYSICAL_PRODUCT:
        if offer.physical is None:
            offer.physical = PhysicalDetails(**(physical or {}))
        elif physical:
            for key, value in physical.items():
                setattr(offer.physical, key, value)
    db.commit()
    return serialize_offer(get_offer_by_ref(db, str(offer.id), only_active=False))


@router.patch("/offers/{offer_id}/status", response_model=OfferOut)
def admin_publish_offer(offer_id: int, payload: OfferStatusIn, db: Session = Depends(get_db)):
    offer = get_offer_by_ref(db, str(offer_id), only_active=False)
    offer.is_active = payload.is_active
    if payload.is_active and offer.published_at is None:
        offer.published_at = utcnow()
    db.commit()
    return serialize_offer(get_offer_by_ref(db, str(offer.id), only_active=False))


@router.delete("/offers/{offer_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_offer(offer_id: int, db: Session = Depends(get_db)):
    offer = get_offer_by_ref(db, str(offer_id), only_active=False)
    if db.scalar(select(func.count(OrderItem.id)).where(OrderItem.offer_id == offer.id)):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Cette offre a déjà été commandée : dépublie-la plutôt que de la supprimer.",
        )
    db.delete(offer)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Créneaux -------------------------------------------------------------


def _slot_out(s: BookingSlot) -> SlotOut:
    out = SlotOut.model_validate(s)
    out.remaining = max(0, s.capacity - s.booked_count)
    return out


@router.get("/offers/{offer_id}/slots", response_model=list[SlotOut])
def admin_list_slots(offer_id: int, db: Session = Depends(get_db)):
    offer = get_offer_by_ref(db, str(offer_id), only_active=False)
    rows = db.scalars(
        select(BookingSlot).where(BookingSlot.offer_id == offer.id).order_by(BookingSlot.starts_at)
    ).all()
    return [_slot_out(s) for s in rows]


@router.post(
    "/offers/{offer_id}/slots", response_model=SlotOut, status_code=status.HTTP_201_CREATED
)
def admin_create_slot(offer_id: int, payload: SlotIn, db: Session = Depends(get_db)):
    offer = get_offer_by_ref(db, str(offer_id), only_active=False)
    if offer.offer_type != OfferType.BOOKING:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Seules les offres de type réservation ont des créneaux."
        )
    slot = BookingSlot(offer_id=offer.id, **payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return _slot_out(slot)


@router.delete("/slots/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_slot(slot_id: int, db: Session = Depends(get_db)):
    slot = db.get(BookingSlot, slot_id)
    if slot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Créneau introuvable.")
    if slot.booked_count > 0:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Ce créneau a des réservations : annule-les d'abord."
        )
    db.delete(slot)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Catégories -----------------------------------------------------------


@router.get("/categories", response_model=list[CategoryOut])
def admin_list_categories(db: Session = Depends(get_db)):
    counts = category_counts(db)
    rows = db.scalars(select(Category).order_by(Category.position, Category.name)).all()
    return [category_out(c, counts) for c in rows]


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def admin_create_category(payload: CategoryIn, db: Session = Depends(get_db)):
    if payload.parent_id is not None and db.get(Category, payload.parent_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Catégorie parente inconnue.")
    data = payload.model_dump(exclude={"slug", "applies_to"})
    category = Category(
        **data,
        slug=unique_slug(db, Category, payload.slug or payload.name),
        applies_to=[t.value for t in payload.applies_to],
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category_out(category, {})


@router.put("/categories/{category_id}", response_model=CategoryOut)
def admin_update_category(category_id: int, payload: CategoryIn, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Catégorie introuvable.")
    if payload.parent_id == category.id:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Une catégorie ne peut pas être son propre parent.")
    category.name = payload.name
    category.parent_id = payload.parent_id
    category.position = payload.position
    category.is_active = payload.is_active
    category.applies_to = [t.value for t in payload.applies_to]
    if payload.slug and payload.slug != category.slug:
        category.slug = unique_slug(db, Category, payload.slug, exclude_id=category.id)
    db.commit()
    db.refresh(category)
    return category_out(category, category_counts(db))


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_category(category_id: int, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Catégorie introuvable.")
    # Les offres de cette catégorie passent « sans catégorie » (voir aussi ON DELETE SET NULL).
    for offer in db.scalars(select(Offer).where(Offer.category_id == category.id)):
        offer.category_id = None
    db.delete(category)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Commandes ------------------------------------------------------------


@router.get("/orders", response_model=Page[AdminOrderOut])
def admin_list_orders(
    status_filter: OrderStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    conds = [Order.status == status_filter] if status_filter else []
    total = db.scalar(select(func.count(Order.id)).where(*conds)) or 0
    rows = db.scalars(
        order_query()
        .options(selectinload(Order.user))
        .where(*conds)
        .order_by(Order.created_at.desc(), Order.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    return Page[AdminOrderOut](
        items=[serialize_admin_order(o) for o in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=total_pages(total, page_size),
    )


def _get_order(db: Session, order_id: int) -> Order:
    order = db.scalars(order_query().options(selectinload(Order.user)).where(Order.id == order_id)).first()
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commande introuvable.")
    return order


@router.get("/orders/{order_id}", response_model=AdminOrderOut)
def admin_get_order(order_id: int, db: Session = Depends(get_db)):
    return serialize_admin_order(_get_order(db, order_id))


@router.patch("/orders/{order_id}/status", response_model=AdminOrderOut)
def admin_set_order_status(order_id: int, payload: OrderStatusIn, db: Session = Depends(get_db)):
    order = _get_order(db, order_id)
    try:
        set_order_status(db, order, payload.status)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return serialize_admin_order(_get_order(db, order_id))


# --- Réservations ---------------------------------------------------------


@router.get("/bookings", response_model=Page[BookingOut])
def admin_list_bookings(
    status_filter: BookingStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    conds = [Booking.status == status_filter] if status_filter else []
    total = db.scalar(select(func.count(Booking.id)).where(*conds)) or 0
    rows = db.scalars(
        select(Booking)
        .options(selectinload(Booking.offer), selectinload(Booking.user))
        .where(*conds)
        .order_by(Booking.starts_at.desc(), Booking.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    return Page[BookingOut](
        items=[serialize_booking(b, with_user=True) for b in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=total_pages(total, page_size),
    )


@router.patch("/bookings/{booking_id}/status", response_model=BookingOut)
def admin_set_booking_status(
    booking_id: int, payload: BookingStatusIn, db: Session = Depends(get_db)
):
    booking = db.scalars(
        select(Booking)
        .options(selectinload(Booking.offer), selectinload(Booking.user))
        .where(Booking.id == booking_id)
    ).first()
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Réservation introuvable.")
    try:
        changed = booking.status != payload.status
        set_booking_status(db, booking, payload.status)
        if changed:
            notify(db, booking.user_id, "booking_status",
                   f"Réservation {BOOKING_LABEL[payload.status]}",
                   booking.offer.title if booking.offer else "", "/compte/reservations")
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(booking)
    return serialize_booking(booking, with_user=True)


# --- Utilisateurs ---------------------------------------------------------


@router.get("/users", response_model=Page[UserOut])
def admin_list_users(
    q: str | None = Query(default=None, max_length=100),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    conds = []
    if q:
        pattern = f"%{q.strip()}%"
        conds.append(or_(User.email.ilike(pattern), User.full_name.ilike(pattern)))
    total = db.scalar(select(func.count(User.id)).where(*conds)) or 0
    rows = db.scalars(
        select(User).where(*conds).order_by(User.id).limit(page_size).offset((page - 1) * page_size)
    ).all()
    return Page[UserOut](
        items=[UserOut.model_validate(u) for u in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=total_pages(total, page_size),
    )


@router.patch("/users/{user_id}", response_model=UserOut)
def admin_update_user(
    user_id: int,
    payload: AdminUserUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Utilisateur introuvable.")
    if user.id == admin.id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Tu ne peux pas modifier ton propre rôle ou ton propre statut.",
        )
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user


# --- Devis ----------------------------------------------------------------


@router.get("/quote-requests", response_model=list[QuoteOut])
def admin_list_quotes(
    status_filter: QuoteStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
):
    stmt = select(QuoteRequest).options(
        selectinload(QuoteRequest.offer), selectinload(QuoteRequest.user)
    )
    if status_filter:
        stmt = stmt.where(QuoteRequest.status == status_filter)
    rows = db.scalars(stmt.order_by(QuoteRequest.created_at.desc(), QuoteRequest.id.desc())).all()
    return [serialize_quote(q, with_user=True) for q in rows]


@router.patch("/quote-requests/{quote_id}/status", response_model=QuoteOut)
def admin_set_quote_status(quote_id: int, payload: QuoteStatusIn, db: Session = Depends(get_db)):
    quote = db.scalars(
        select(QuoteRequest)
        .options(selectinload(QuoteRequest.offer), selectinload(QuoteRequest.user))
        .where(QuoteRequest.id == quote_id)
    ).first()
    if quote is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demande introuvable.")
    if quote.status != payload.status:
        notify(db, quote.user_id, "quote_status", f"Demande de devis {QUOTE_LABEL[payload.status]}",
               quote.offer.title if quote.offer else "", "/compte/devis")
    quote.status = payload.status
    db.commit()
    return serialize_quote(quote, with_user=True)


# --- Statistiques ---------------------------------------------------------


@router.get("/stats")
def admin_stats(db: Session = Depends(get_db)):
    def count(model, *conds) -> int:
        return db.scalar(select(func.count(model.id)).where(*conds)) or 0

    revenue = db.scalar(
        select(func.coalesce(func.sum(Order.total), 0)).where(
            Order.payment_status == PaymentStatus.PAID,
            Order.status.not_in([OrderStatus.CANCELLED, OrderStatus.REFUNDED]),
        )
    )
    return {
        "offers": {"total": count(Offer), "published": count(Offer, Offer.is_active.is_(True))},
        "users": count(User),
        "orders": {
            "total": count(Order),
            "pending": count(Order, Order.status == OrderStatus.PENDING),
            "revenue": float(revenue or 0),
        },
        "bookings_pending": count(Booking, Booking.status == BookingStatus.PENDING),
        "quotes_new": count(QuoteRequest, QuoteRequest.status == QuoteStatus.NEW),
    }
