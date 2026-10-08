from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models import OfferType, PriceMode
from app.schemas.common import ORMModel, Page


class CategoryBrief(ORMModel):
    id: int
    name: str
    slug: str


class OwnerBrief(ORMModel):
    id: int
    full_name: str


class PhysicalOut(ORMModel):
    sku: str | None = None
    stock: int
    weight_g: int | None = None
    dimensions: dict = {}


class OfferOut(ORMModel):
    id: int
    title: str
    slug: str
    description: str
    offer_type: OfferType
    price: float | None
    old_price: float | None
    price_mode: PriceMode
    currency: str
    category: CategoryBrief | None
    owner: OwnerBrief | None
    image: str | None
    gallery: list[str]
    attributes: dict
    rating_avg: float
    rating_count: int
    is_active: bool
    is_featured: bool
    published_at: datetime | None
    created_at: datetime
    # Calculés côté serveur à partir du registre des types
    capabilities: dict
    primary_action: str
    in_stock: bool
    stock: int | None
    next_slot_at: datetime | None
    physical: PhysicalOut | None = None


class FacetValue(BaseModel):
    value: str
    label: str | None = None
    count: int


class OfferFacets(BaseModel):
    types: list[FacetValue]
    categories: list[FacetValue]
    price_min: float | None
    price_max: float | None


class OfferPage(Page[OfferOut]):
    facets: OfferFacets


class CategoryOut(ORMModel):
    id: int
    name: str
    slug: str
    parent_id: int | None
    applies_to: list[str]
    position: int
    is_active: bool
    offer_count: int = 0


class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    slug: str | None = Field(default=None, max_length=120)
    parent_id: int | None = None
    applies_to: list[OfferType] = []
    position: int = 0
    is_active: bool = True


class PhysicalIn(BaseModel):
    sku: str | None = Field(default=None, max_length=64)
    stock: int = Field(default=0, ge=0)
    weight_g: int | None = Field(default=None, ge=0)
    dimensions: dict = {}


class OfferCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = ""
    offer_type: OfferType
    price: float | None = Field(default=None, ge=0)
    old_price: float | None = Field(default=None, ge=0)
    price_mode: PriceMode = PriceMode.FIXED
    currency: str = Field(default="EUR", min_length=3, max_length=3)
    category_id: int | None = None
    image: str | None = Field(default=None, max_length=500)
    gallery: list[str] = []
    attributes: dict = {}
    is_active: bool = False
    is_featured: bool = False
    physical: PhysicalIn | None = None

    @model_validator(mode="after")
    def check_price(self) -> "OfferCreate":
        if self.price_mode != PriceMode.QUOTE and self.price is None:
            raise ValueError("Le prix est obligatoire (sauf pour une offre sur devis).")
        return self


class OfferUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = None
    offer_type: OfferType | None = None
    price: float | None = Field(default=None, ge=0)
    old_price: float | None = Field(default=None, ge=0)
    price_mode: PriceMode | None = None
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    category_id: int | None = None
    image: str | None = Field(default=None, max_length=500)
    gallery: list[str] | None = None
    attributes: dict | None = None
    is_featured: bool | None = None
    physical: PhysicalIn | None = None


class OfferStatusIn(BaseModel):
    is_active: bool


class SlotIn(BaseModel):
    starts_at: datetime
    ends_at: datetime
    capacity: int = Field(default=1, ge=1, le=500)

    @model_validator(mode="after")
    def check_dates(self) -> "SlotIn":
        if self.ends_at <= self.starts_at:
            raise ValueError("La fin du créneau doit être après son début.")
        return self


class SlotOut(ORMModel):
    id: int
    offer_id: int
    starts_at: datetime
    ends_at: datetime
    capacity: int
    booked_count: int
    remaining: int = 0


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=2000)


class ReviewOut(BaseModel):
    id: int
    offer_id: int
    offer_title: str | None = None
    offer_slug: str | None = None
    user_name: str
    rating: int
    comment: str
    created_at: datetime
