"""Création et cycle de vie des commandes, réservations et demandes de devis."""

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Booking,
    BookingSlot,
    BookingStatus,
    Offer,
    OfferType,
    Order,
    OrderItem,
    OrderStatus,
    PaymentStatus,
    PhysicalDetails,
    PriceMode,
    QuoteRequest,
    User,
)
from app.schemas.order import (
    AdminOrderOut,
    BookingOut,
    OrderCreate,
    OrderOut,
    QuoteOut,
)
from app.services.offers import as_aware, utcnow
from app.services.notifications import BOOKING_LABEL, ORDER_LABEL, notify, notify_admins
from app.services.payments import get_payment_provider

SHIPPING_RATES = {"standard": Decimal("5.00"), "express": Decimal("12.00")}
FREE_STANDARD_SHIPPING_FROM = Decimal("100.00")
MAX_SESSIONS = 20
ACTIVE_BOOKING = (BookingStatus.PENDING, BookingStatus.ACCEPTED)


def _fail(code: int, detail: str):
    raise HTTPException(code, detail)


def create_order(db: Session, user: User, payload: OrderCreate) -> Order:
    ids = {i.offer_id for i in payload.items}
    offers = {
        o.id: o
        for o in db.scalars(select(Offer).where(Offer.id.in_(ids)).options(selectinload(Offer.physical)))
    }
    # Verrouillage des lignes de stock et de créneaux pour éviter la survente (PostgreSQL).
    physicals = {
        p.offer_id: p
        for p in db.scalars(
            select(PhysicalDetails).where(PhysicalDetails.offer_id.in_(ids)).with_for_update()
        )
    }
    slot_ids = {i.slot_id for i in payload.items if i.slot_id}
    slots = {
        s.id: s
        for s in db.scalars(select(BookingSlot).where(BookingSlot.id.in_(slot_ids)).with_for_update())
    } if slot_ids else {}

    now = utcnow()
    lines: list[tuple[OrderItem, Offer, BookingSlot | None]] = []
    subtotal = Decimal("0")
    physical_subtotal = Decimal("0")
    needs_shipping = False
    has_digital = False
    currencies: set[str] = set()

    for item in payload.items:
        offer = offers.get(item.offer_id)
        if offer is None or not offer.is_active:
            _fail(status.HTTP_404_NOT_FOUND, f"L'offre n°{item.offer_id} n'est pas disponible.")
        if offer.price_mode == PriceMode.QUOTE or offer.price is None:
            _fail(
                status.HTTP_400_BAD_REQUEST,
                f"« {offer.title} » est sur devis : envoie une demande de devis.",
            )
        qty = item.quantity
        slot: BookingSlot | None = None

        if offer.offer_type == OfferType.PHYSICAL_PRODUCT:
            needs_shipping = True
            phys = physicals.get(offer.id)
            if phys is None or phys.stock < qty:
                _fail(status.HTTP_409_CONFLICT, f"Stock insuffisant pour « {offer.title} ».")
            phys.stock -= qty
        elif offer.offer_type == OfferType.DIGITAL_PRODUCT:
            has_digital = True
            qty = 1
        elif offer.offer_type == OfferType.BOOKING:
            qty = 1
            slot = slots.get(item.slot_id) if item.slot_id else None
            if slot is None or slot.offer_id != offer.id:
                _fail(status.HTTP_400_BAD_REQUEST, f"Choisis un créneau pour « {offer.title} ».")
            if as_aware(slot.starts_at) <= now:
                _fail(status.HTTP_409_CONFLICT, "Ce créneau est déjà passé.")
            if slot.booked_count >= slot.capacity:
                _fail(status.HTTP_409_CONFLICT, "Ce créneau est complet.")
            slot.booked_count += 1
        else:  # SERVICE
            if qty > MAX_SESSIONS:
                _fail(status.HTTP_400_BAD_REQUEST, f"Maximum {MAX_SESSIONS} prestations par ligne.")

        unit = Decimal(offer.price)
        subtotal += unit * qty
        if offer.offer_type == OfferType.PHYSICAL_PRODUCT:
            physical_subtotal += unit * qty
        currencies.add(offer.currency)

        metadata = dict(item.metadata)
        if slot is not None:
            metadata["slot_id"] = slot.id
            metadata["starts_at"] = as_aware(slot.starts_at).isoformat()
            metadata["ends_at"] = as_aware(slot.ends_at).isoformat()
        order_item = OrderItem(
            offer_id=offer.id,
            offer_snapshot={
                "title": offer.title,
                "slug": offer.slug,
                "offer_type": offer.offer_type.value,
                "price_mode": offer.price_mode.value,
                "image": offer.image,
                "currency": offer.currency,
            },
            quantity=qty,
            unit_price=unit,
            item_metadata=metadata,
        )
        lines.append((order_item, offer, slot))

    if len(currencies) > 1:
        _fail(status.HTTP_400_BAD_REQUEST, "Les offres du panier n'ont pas la même devise.")
    if payload.payment_method == "on_delivery" and has_digital:
        _fail(status.HTTP_400_BAD_REQUEST, "Un produit numérique se règle en ligne.")

    shipping_cost = Decimal("0")
    shipping_method = None
    if needs_shipping:
        if payload.shipping_address is None:
            _fail(status.HTTP_400_BAD_REQUEST, "Une adresse de livraison est requise.")
        shipping_method = payload.shipping_method or "standard"
        shipping_cost = SHIPPING_RATES[shipping_method]
        if shipping_method == "standard" and physical_subtotal >= FREE_STANDARD_SHIPPING_FROM:
            shipping_cost = Decimal("0")

    total = subtotal + shipping_cost
    currency = next(iter(currencies))
    order = Order(
        user_id=user.id,
        subtotal=subtotal,
        shipping_cost=shipping_cost,
        total=total,
        currency=currency,
        payment_method=payload.payment_method,
        shipping_method=shipping_method,
        shipping_address=payload.shipping_address.model_dump() if needs_shipping and payload.shipping_address else None,
        customer_info=payload.customer_info.model_dump(),
        notes=payload.notes,
        status=OrderStatus.PENDING,
        payment_status=PaymentStatus.PENDING,
    )
    if payload.payment_method == "demo_card":
        result = get_payment_provider().charge(total, currency, payload.payment_method)
        if not result.success:
            _fail(status.HTTP_402_PAYMENT_REQUIRED, "Le paiement a été refusé.")
        order.payment_status = PaymentStatus.PAID
        order.status = OrderStatus.CONFIRMED

    for order_item, _offer, _slot in lines:
        order.items.append(order_item)
    db.add(order)
    db.flush()

    for order_item, offer, slot in lines:
        if slot is not None:
            db.add(
                Booking(
                    user_id=user.id,
                    offer_id=offer.id,
                    slot_id=slot.id,
                    order_item_id=order_item.id,
                    status=BookingStatus.PENDING,
                    notes=(order_item.item_metadata or {}).get("notes"),
                    starts_at=slot.starts_at,
                    ends_at=slot.ends_at,
                )
            )
    n_slots = sum(1 for _o, _f, slot in lines if slot is not None)
    amount = f"{order.total:.2f}".replace(".", ",") + (" €" if currency == "EUR" else f" {currency}")
    detail = f"{user.full_name} · {amount}"
    if n_slots:
        detail += f" · {n_slots} réservation{'s' if n_slots > 1 else ''} à confirmer"
    notify_admins(
        db, "order_new", f"Nouvelle commande n°{order.id}", detail, "/admin/commandes", exclude_user_id=user.id
    )
    db.commit()
    db.refresh(order)
    return order


def release_slot(db: Session, booking: Booking) -> None:
    if booking.slot_id:
        slot = db.get(BookingSlot, booking.slot_id)
        if slot is not None:
            slot.booked_count = max(0, slot.booked_count - 1)


def set_booking_status(db: Session, booking: Booking, new: BookingStatus) -> Booking:
    old = booking.status
    if old == new:
        return booking
    if old not in ACTIVE_BOOKING and new in ACTIVE_BOOKING:
        _fail(status.HTTP_409_CONFLICT, "Cette réservation est clôturée : il faut en créer une nouvelle.")
    if old in ACTIVE_BOOKING and new in (BookingStatus.REFUSED, BookingStatus.CANCELLED):
        release_slot(db, booking)
    booking.status = new
    return booking


def cancel_order(db: Session, order: Order, by_admin: bool = False) -> Order:
    if order.status in (OrderStatus.CANCELLED, OrderStatus.REFUNDED):
        _fail(status.HTTP_409_CONFLICT, "Cette commande est déjà annulée.")
    if not by_admin and order.status not in (OrderStatus.PENDING, OrderStatus.CONFIRMED):
        _fail(status.HTTP_409_CONFLICT, "Cette commande ne peut plus être annulée.")

    item_ids = [i.id for i in order.items]
    for item in order.items:
        if item.offer_id and item.offer_snapshot.get("offer_type") == OfferType.PHYSICAL_PRODUCT.value:
            phys = db.get(PhysicalDetails, item.offer_id)
            if phys is not None:
                phys.stock += item.quantity
    if item_ids:
        for booking in db.scalars(select(Booking).where(Booking.order_item_id.in_(item_ids))):
            if booking.status in ACTIVE_BOOKING:
                release_slot(db, booking)
                booking.status = BookingStatus.CANCELLED
    order.status = OrderStatus.CANCELLED
    if order.payment_status == PaymentStatus.PAID:
        order.payment_status = PaymentStatus.REFUNDED
    return order


def set_order_status(db: Session, order: Order, new: OrderStatus) -> Order:
    if order.status == new:
        return order
    if order.status in (OrderStatus.CANCELLED, OrderStatus.REFUNDED):
        _fail(status.HTTP_409_CONFLICT, "Une commande annulée ne peut plus changer de statut.")
    if new == OrderStatus.CANCELLED:
        cancel_order(db, order, by_admin=True)
        notify(db, order.user_id, "order_status", f"Commande n°{order.id} annulée",
               "Ta commande a été annulée par la boutique.", f"/commande/confirmation/{order.id}")
        return order
    order.status = new
    notify(db, order.user_id, "order_status", f"Commande n°{order.id} : {ORDER_LABEL[new]}",
           "Le statut de ta commande a changé.", f"/commande/confirmation/{order.id}")
    if new == OrderStatus.REFUNDED:
        order.payment_status = PaymentStatus.REFUNDED
    elif new in (OrderStatus.DELIVERED, OrderStatus.COMPLETED) and order.payment_method == "on_delivery":
        order.payment_status = PaymentStatus.PAID
    return order


def order_query():
    return select(Order).options(selectinload(Order.items))


def serialize_order(order: Order) -> OrderOut:
    return OrderOut.model_validate(order)


def serialize_admin_order(order: Order) -> AdminOrderOut:
    data = OrderOut.model_validate(order).model_dump(by_alias=False)
    return AdminOrderOut(**data, user_email=order.user.email, user_name=order.user.full_name)


def serialize_booking(b: Booking, with_user: bool = False) -> BookingOut:
    out = BookingOut.model_validate(b)
    out.offer_title = b.offer.title if b.offer else None
    out.offer_slug = b.offer.slug if b.offer else None
    if with_user:
        out.user_name = b.user.full_name
        out.user_email = b.user.email
    return out


def serialize_quote(q: QuoteRequest, with_user: bool = False) -> QuoteOut:
    out = QuoteOut.model_validate(q)
    out.offer_title = q.offer.title if q.offer else None
    if with_user:
        out.user_name = q.user.full_name
        out.user_email = q.user.email
    return out
