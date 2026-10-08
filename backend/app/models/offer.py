import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, JSONType
from app.models.category import Category
from app.models.user import User


class OfferType(str, enum.Enum):
    PHYSICAL_PRODUCT = "PHYSICAL_PRODUCT"
    SERVICE = "SERVICE"
    DIGITAL_PRODUCT = "DIGITAL_PRODUCT"
    BOOKING = "BOOKING"


class PriceMode(str, enum.Enum):
    FIXED = "FIXED"
    STARTING_AT = "STARTING_AT"
    QUOTE = "QUOTE"


class Offer(Base):
    __tablename__ = "offers"
    __table_args__ = (
        CheckConstraint("price IS NULL OR price >= 0", name="ck_offers_price_positive"),
        CheckConstraint(
            "price_mode = 'QUOTE' OR price IS NOT NULL", name="ck_offers_price_required"
        ),
        Index("ix_offers_listing", "is_active", "offer_type", "published_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    offer_type: Mapped[OfferType] = mapped_column(
        Enum(OfferType, native_enum=False, length=30), index=True
    )

    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    old_price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    price_mode: Mapped[PriceMode] = mapped_column(
        Enum(PriceMode, native_enum=False, length=20), default=PriceMode.FIXED
    )
    currency: Mapped[str] = mapped_column(String(3), default="EUR")

    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), index=True, nullable=True
    )
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )

    image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    gallery: Mapped[list] = mapped_column(JSONType, default=list)
    # Données propres au type : durée, prestations incluses, format, taille, etc.
    attributes: Mapped[dict] = mapped_column(JSONType, default=dict)

    rating_avg: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)

    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    category: Mapped[Category | None] = relationship()
    owner: Mapped[User | None] = relationship()
    physical: Mapped["PhysicalDetails | None"] = relationship(
        back_populates="offer", uselist=False, cascade="all, delete-orphan"
    )
    slots: Mapped[list["BookingSlot"]] = relationship(
        back_populates="offer", cascade="all, delete-orphan"
    )


class PhysicalDetails(Base):
    """Extension 1-1 pour les produits physiques (stock et logistique)."""

    __tablename__ = "physical_details"
    __table_args__ = (CheckConstraint("stock >= 0", name="ck_physical_stock_positive"),)

    offer_id: Mapped[int] = mapped_column(
        ForeignKey("offers.id", ondelete="CASCADE"), primary_key=True
    )
    sku: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    weight_g: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dimensions: Mapped[dict] = mapped_column(JSONType, default=dict)

    offer: Mapped[Offer] = relationship(back_populates="physical")


class BookingSlot(Base):
    """Créneau réservable pour une offre de type BOOKING."""

    __tablename__ = "booking_slots"
    __table_args__ = (
        CheckConstraint("ends_at > starts_at", name="ck_slot_dates"),
        CheckConstraint("booked_count <= capacity", name="ck_slot_capacity"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    offer_id: Mapped[int] = mapped_column(
        ForeignKey("offers.id", ondelete="CASCADE"), index=True
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    capacity: Mapped[int] = mapped_column(Integer, default=1)
    booked_count: Mapped[int] = mapped_column(Integer, default=0)

    offer: Mapped[Offer] = relationship(back_populates="slots")
