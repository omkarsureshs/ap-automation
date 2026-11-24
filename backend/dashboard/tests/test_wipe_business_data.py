import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from invoices.models import Invoice
from procurement.models import PurchaseOrder
from vendors.models import Vendor
from workflow.models import ApprovalRule, Notification


@pytest.mark.django_db
def test_wipe_business_data_removes_business_rows_but_keeps_logins_and_rule():
    call_command("seed_demo")  # full seed, including business data
    assert Vendor.objects.exists()
    assert Invoice.objects.exists()
    assert PurchaseOrder.objects.exists()

    call_command("wipe_business_data")

    assert Vendor.objects.count() == 0
    assert Invoice.objects.count() == 0
    assert PurchaseOrder.objects.count() == 0
    assert Notification.objects.count() == 0
    assert get_user_model().objects.filter(email="admin@demo.com").exists()
    assert ApprovalRule.objects.exists()


@pytest.mark.django_db
def test_wipe_business_data_is_safe_to_run_on_an_empty_database():
    call_command("seed_demo", "--users-only")
    call_command("wipe_business_data")  # should not raise
    assert get_user_model().objects.filter(email="admin@demo.com").exists()
