import abc
import dataclasses
from decimal import Decimal
from uuid import uuid4

from django.conf import settings


@dataclasses.dataclass
class PaymentResult:
    status: str  # "completed" or "failed"
    gateway_reference: str
    failure_reason: str | None = None


class BankingGateway(abc.ABC):
    @abc.abstractmethod
    def initiate_payment(self, amount: Decimal, reference: str) -> PaymentResult:
        raise NotImplementedError


class MockBankingGateway(BankingGateway):
    """Simulates a real gateway's request/response shape (DECISIONS.md #7).

    Every payment completes: this stub demonstrates the adapter boundary a
    real gateway (e.g. Razorpay) would be swapped in behind, not fabricated
    failure randomness — a production gateway has real failure modes, a mock
    with no real network call does not need invented ones for the demo.
    """

    def initiate_payment(self, amount: Decimal, reference: str) -> PaymentResult:
        return PaymentResult(status="completed", gateway_reference=f"MOCK-{uuid4().hex[:12].upper()}")


_GATEWAYS = {
    "mock": MockBankingGateway,
}


def get_gateway() -> BankingGateway:
    name = getattr(settings, "BANKING_GATEWAY", "mock")
    gateway_cls = _GATEWAYS.get(name, MockBankingGateway)
    return gateway_cls()
