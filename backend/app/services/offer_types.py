"""Registre des capacités par type d'offre.

Point unique où l'on décrit ce que sait faire chaque type. Ajouter un type =
ajouter une entrée ici (+ le miroir frontend `src/offers/offerTypes.ts`).
"""

from dataclasses import asdict, dataclass

from app.models.offer import OfferType, PriceMode


@dataclass(frozen=True)
class OfferTypeConfig:
    has_stock: bool
    needs_shipping: bool
    needs_slot: bool
    primary_action: str
    quantity_mode: str  # UNITS | SESSIONS | NONE


OFFER_TYPE_CONFIG: dict[OfferType, OfferTypeConfig] = {
    OfferType.PHYSICAL_PRODUCT: OfferTypeConfig(True, True, False, "ADD_TO_CART", "UNITS"),
    OfferType.DIGITAL_PRODUCT: OfferTypeConfig(False, False, False, "BUY_NOW", "NONE"),
    OfferType.SERVICE: OfferTypeConfig(False, False, False, "ORDER_SERVICE", "SESSIONS"),
    OfferType.BOOKING: OfferTypeConfig(False, False, True, "BOOK", "NONE"),
}


def get_capabilities(offer_type: OfferType) -> dict:
    return asdict(OFFER_TYPE_CONFIG[offer_type])


def get_primary_action(offer_type: OfferType, price_mode: PriceMode) -> str:
    """Un prix sur devis impose l'action « demander un devis », quel que soit le type."""
    if price_mode == PriceMode.QUOTE:
        return "REQUEST_QUOTE"
    return OFFER_TYPE_CONFIG[offer_type].primary_action
