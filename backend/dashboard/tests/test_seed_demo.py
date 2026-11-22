import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from invoices.gstin import is_valid_gstin
from invoices.models import Invoice, InvoiceException
from payments.models import Payment
from vendors.models import Vendor
from workflow.models import ApprovalRule


@pytest.mark.django_db
def test_seed_demo_users_only_creates_logins_but_no_demo_data():
    call_command("seed_demo", "--users-only")
    assert get_user_model().objects.filter(email="admin@demo.com").exists()
    assert ApprovalRule.objects.exists()
    assert Vendor.objects.count() == 0
    assert Invoice.objects.count() == 0
    assert Payment.objects.count() == 0


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
