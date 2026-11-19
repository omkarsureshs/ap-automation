from django.db import connection

from vendors.models import Vendor


def test_encrypted_field_stores_ciphertext_and_returns_plaintext(db):
    vendor = Vendor.objects.create(
        name="Acme",
        gstin="27AAAAA0000A1Z5",
        email="a@acme.test",
        bank_account_number="1234567890",
        bank_ifsc="HDFC0001234",
    )

    with connection.cursor() as cursor:
        cursor.execute("SELECT bank_account_number FROM vendors_vendor WHERE id = %s", [vendor.id])
        raw_value = cursor.fetchone()[0]

    assert raw_value != "1234567890"
    assert Vendor.objects.get(pk=vendor.pk).bank_account_number == "1234567890"
