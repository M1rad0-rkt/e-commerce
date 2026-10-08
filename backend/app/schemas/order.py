from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, computed_field

from app.models import BookingStatus, OrderStatus, PaymentStatus, QuoteStatus
from app.schemas.common import ORMModel


class OrderItemIn(BaseModel):
    offer_id: int
    quantity: int = Field(default=1, ge=1, le=99)
    slot_id: int | None = None
    metadata: dict = {}


class CustomerInfo(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=40)


class ShippingAddress(BaseModel):
    line1: str = Field(min_length=3, max_length=200)
    line2: str | None = Field(default=None, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=1, max_length=20)
    country: str = Field(min_length=2, max_length=80)


class OrderCreate(BaseModel):
    items: list[OrderItemIn] = Field(min_length=1, max_length=50)
    customer_info: CustomerInfo
    shipping_address: ShippingAddress | None = None
    shipping_method: Literal["standard", "express"] | None = None
    payment_method: Literal["demo_card", "on_delivery"] = "demo_card"
    notes: str | None = Field(default=None, max_length=2000)


class OrderItemOut(ORMModel):
    id: int
    offer_id: int | None
    offer_snapshot: dict
    quantity: int
    unit_price: float
    metadata: dict = Field(validation_alias="item_metadata")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def line_total(self) -> float:
        return round(self.unit_price * self.quantity, 2)


class OrderOut(ORMModel):
    id: int
    user_id: int
    status: OrderStatus
    payment_status: PaymentStatus
    payment_method: str
    subtotal: float
    shipping_cost: float
    total: float
    currency: str
    shipping_method: str | None
    shipping_address: dict | None
    customer_info: dict
    notes: str | None
    created_at: datetime
    items: list[OrderItemOut]


class AdminOrderOut(OrderOut):
    user_email: str | None = None
    user_name: str | None = None


class OrderStatusIn(BaseModel):
    status: OrderStatus


class BookingOut(ORMModel):
    id: int
    user_id: int
    offer_id: int
    offer_title: str | None = None
    offer_slug: str | None = None
    slot_id: int | None
    order_item_id: int | None
    status: BookingStatus
    notes: str | None
    starts_at: datetime
    ends_at: datetime
    created_at: datetime
    user_name: str | None = None
    user_email: str | None = None


class BookingStatusIn(BaseModel):
    status: BookingStatus


class QuoteIn(BaseModel):
    offer_id: int
    message: str = Field(min_length=10, max_length=3000)
    phone: str | None = Field(default=None, max_length=40)


class QuoteOut(ORMModel):
    id: int
    offer_id: int
    offer_title: str | None = None
    message: str
    phone: str | None
    status: QuoteStatus
    created_at: datetime
    user_name: str | None = None
    user_email: str | None = None


class QuoteStatusIn(BaseModel):
    status: QuoteStatus


Money = Decimal
