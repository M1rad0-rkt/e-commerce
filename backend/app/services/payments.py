"""Interface de paiement. Le fournisseur de démonstration ne débite rien.

Pour brancher un vrai fournisseur (mobile money, Stripe, etc.), implémenter
`PaymentProvider` et changer `get_payment_provider()`.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol


@dataclass
class PaymentResult:
    success: bool
    reference: str | None = None


class PaymentProvider(Protocol):
    def charge(self, amount: Decimal, currency: str, method: str) -> PaymentResult: ...


class DemoPaymentProvider:
    def charge(self, amount: Decimal, currency: str, method: str) -> PaymentResult:
        return PaymentResult(success=True, reference="DEMO-PAYMENT")


def get_payment_provider() -> PaymentProvider:
    return DemoPaymentProvider()
