from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.dependencies import get_current_user, get_db
from app.models import Booking, BookingStatus, Offer, Order, QuoteRequest, User
from app.schemas.common import Page, total_pages
from app.schemas.order import BookingOut, OrderCreate, OrderOut, QuoteIn, QuoteOut
from app.services.notifications import notify_admins
from app.services.offers import as_aware, utcnow
from app.services.orders import (
    ACTIVE_BOOKING,
    cancel_order,
    create_order,
    order_query,
    serialize_booking,
    serialize_order,
    serialize_quote,
    set_booking_status,
)

router = APIRouter(tags=["orders"])


# --- Commandes ------------------------------------------------------------


@router.post("/orders", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def post_order(
    payload: OrderCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    try:
        order = create_order(db, user, payload)
    except Exception:
        db.rollback()
        raise
    return serialize_order(order)


@router.get("/orders", response_model=Page[OrderOut])
def my_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    total = db.scalar(select(func.count(Order.id)).where(Order.user_id == user.id)) or 0
    rows = db.scalars(
        order_query()
        .where(Order.user_id == user.id)
        .order_by(Order.created_at.desc(), Order.id.desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    ).all()
    return Page[OrderOut](
        items=[serialize_order(o) for o in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=total_pages(total, page_size),
    )


def _own_order(db: Session, user: User, order_id: int) -> Order:
    order = db.scalars(order_query().where(Order.id == order_id)).first()
    if order is None or order.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Commande introuvable.")
    return order


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return serialize_order(_own_order(db, user, order_id))


@router.post("/orders/{order_id}/cancel", response_model=OrderOut)
def cancel_my_order(
    order_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    order = _own_order(db, user, order_id)
    cancel_order(db, order)
    notify_admins(db, "order_cancelled", f"Commande n°{order.id} annulée par le client",
                  user.full_name, "/admin/commandes", exclude_user_id=user.id)
    db.commit()
    db.refresh(order)
    return serialize_order(order)


# --- Réservations ---------------------------------------------------------


def _booking_query():
    return select(Booking).options(selectinload(Booking.offer), selectinload(Booking.user))


@router.get("/bookings", response_model=list[BookingOut])
def my_bookings(
    status_filter: BookingStatus | None = Query(default=None, alias="status"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = _booking_query().where(Booking.user_id == user.id)
    if status_filter:
        stmt = stmt.where(Booking.status == status_filter)
    rows = db.scalars(stmt.order_by(Booking.starts_at.desc(), Booking.id.desc())).all()
    return [serialize_booking(b) for b in rows]


def _own_booking(db: Session, user: User, booking_id: int) -> Booking:
    booking = db.scalars(_booking_query().where(Booking.id == booking_id)).first()
    if booking is None or booking.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Réservation introuvable.")
    return booking


@router.get("/bookings/{booking_id}", response_model=BookingOut)
def get_booking(
    booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return serialize_booking(_own_booking(db, user, booking_id))


@router.post("/bookings/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(
    booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    booking = _own_booking(db, user, booking_id)
    if booking.status not in ACTIVE_BOOKING:
        raise HTTPException(status.HTTP_409_CONFLICT, "Cette réservation ne peut plus être annulée.")
    if as_aware(booking.starts_at) <= utcnow():
        raise HTTPException(status.HTTP_409_CONFLICT, "Cette réservation est déjà passée.")
    set_booking_status(db, booking, BookingStatus.CANCELLED)
    notify_admins(db, "booking_cancelled", "Réservation annulée par le client",
                  f"{user.full_name} · {booking.offer.title}", "/admin/reservations", exclude_user_id=user.id)
    db.commit()
    db.refresh(booking)
    return serialize_booking(booking)


# --- Demandes de devis ----------------------------------------------------


@router.post("/quote-requests", response_model=QuoteOut, status_code=status.HTTP_201_CREATED)
def create_quote(
    payload: QuoteIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    offer = db.get(Offer, payload.offer_id)
    if offer is None or not offer.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Offre introuvable.")
    quote = QuoteRequest(
        user_id=user.id, offer_id=offer.id, message=payload.message.strip(), phone=payload.phone
    )
    db.add(quote)
    notify_admins(db, "quote_new", "Nouvelle demande de devis",
                  f"{user.full_name} · {offer.title}", "/admin/devis", exclude_user_id=user.id)
    db.commit()
    db.refresh(quote)
    return serialize_quote(quote)


@router.get("/quote-requests", response_model=list[QuoteOut])
def my_quotes(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(QuoteRequest)
        .where(QuoteRequest.user_id == user.id)
        .options(selectinload(QuoteRequest.offer))
        .order_by(QuoteRequest.created_at.desc(), QuoteRequest.id.desc())
    ).all()
    return [serialize_quote(q) for q in rows]
