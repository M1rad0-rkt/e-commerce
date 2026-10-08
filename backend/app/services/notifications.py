"""Création des notifications. Les fonctions ajoutent la ligne à la session
sans valider : c'est la route (ou le service appelant) qui fait le commit,
pour que l'événement et sa notification soient enregistrés ensemble."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Notification, OrderStatus, User, UserRole
from app.models.commerce import BookingStatus, QuoteStatus

ORDER_LABEL = {
    OrderStatus.PENDING: "en attente",
    OrderStatus.CONFIRMED: "confirmée",
    OrderStatus.IN_PROGRESS: "en cours de traitement",
    OrderStatus.SHIPPED: "expédiée",
    OrderStatus.DELIVERED: "livrée",
    OrderStatus.COMPLETED: "terminée",
    OrderStatus.CANCELLED: "annulée",
    OrderStatus.REFUNDED: "remboursée",
}
BOOKING_LABEL = {
    BookingStatus.PENDING: "à confirmer",
    BookingStatus.ACCEPTED: "acceptée",
    BookingStatus.REFUSED: "refusée",
    BookingStatus.CANCELLED: "annulée",
    BookingStatus.COMPLETED: "terminée",
}
QUOTE_LABEL = {
    QuoteStatus.NEW: "nouvelle",
    QuoteStatus.ANSWERED: "répondue",
    QuoteStatus.CLOSED: "clôturée",
}


def notify(
    db: Session, user_id: int, kind: str, title: str, body: str = "", link: str | None = None
) -> Notification:
    n = Notification(user_id=user_id, kind=kind, title=title[:200], body=body, link=link)
    db.add(n)
    return n


def notify_admins(
    db: Session,
    kind: str,
    title: str,
    body: str = "",
    link: str | None = None,
    exclude_user_id: int | None = None,
) -> None:
    """Une notification pour chaque administrateur actif (sauf l'auteur de l'action)."""
    stmt = select(User.id).where(User.role == UserRole.ADMIN, User.is_active.is_(True))
    for admin_id in db.scalars(stmt):
        if admin_id != exclude_user_id:
            notify(db, admin_id, kind, title, body, link)
