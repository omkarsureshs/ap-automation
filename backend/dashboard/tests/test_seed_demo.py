import pytest
from django.core.management import call_command

from invoices.gstin import is_valid_gstin
from invoices.models import Invoice, InvoiceException
from payments.models import Payment
from vendors.models import Vendor


@pytest.mark.django_db
def test_seed_demo_idempotent():
    call_command("seed_demo")
    counts = (Invoice.objects.count(), Vendor.objects.count(), Payment.objects.count(), InvoiceException.objects.count())
    call_command("seed_demo")
    assert counts == (
        Invoice.objects.count(), Vendor.objects.count(), Payment.objects.count(), InvoiceException.objects.count()
    )
    assert counts[0] >= 12 and counts[1] == 3 and counts[2] >= 2
    assert set(Invoice.objects.values_list("status", flat=True)) == {s for s, _ in Invoice.STATUS_CHOICES}
    assert all(is_valid_gstin(v.gstin) for v in Vendor.objects.all())
