import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image, ImageDraw, ImageFont
from rest_framework.test import APIClient

MINIMAL_PDF = (
    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
    b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
    b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n"
    b"xref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF"
)


def _auth_client(django_user_model, email, role):
    django_user_model.objects.create_user(email=email, password="pw12345!", role=role)
    client = APIClient()
    resp = client.post("/api/auth/login/", {"email": email, "password": "pw12345!"})
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.json()['access']}")
    return client


@pytest.fixture
def auth_client_requester(db, django_user_model):
    return _auth_client(django_user_model, "requester@x.com", "requester")


@pytest.fixture
def auth_client_vendor(db, django_user_model):
    return _auth_client(django_user_model, "vendor@x.com", "vendor")


@pytest.fixture
def auth_client_ap_admin(db, django_user_model):
    return _auth_client(django_user_model, "apadmin@x.com", "ap_admin")


@pytest.fixture
def pdf_file():
    return SimpleUploadedFile("invoice.pdf", MINIMAL_PDF, content_type="application/pdf")


@pytest.fixture
def txt_file():
    return SimpleUploadedFile("notes.txt", b"not an invoice", content_type="text/plain")


@pytest.fixture
def sample_invoice_image_path(tmp_path):
    img = Image.new("RGB", (600, 150), color="white")
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=48)
    draw.text((20, 40), "INVOICE", fill="black", font=font)
    path = tmp_path / "sample_invoice.png"
    img.save(path)
    return str(path)


@pytest.fixture
def exe_renamed_to_pdf():
    # Real Windows PE header bytes ("MZ..."), renamed with a .pdf extension.
    return SimpleUploadedFile("invoice.pdf", b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00", content_type="application/pdf")


@pytest.fixture
def corrupt_pdf_with_valid_header():
    # Passes the magic-byte check (starts with %PDF) but has no real
    # PDF structure after it, so pdf2image fails to convert it.
    return SimpleUploadedFile("corrupt.pdf", b"%PDF-1.4\nthis is not a real pdf body", content_type="application/pdf")


@pytest.fixture
def valid_invoice_image_file():
    img = Image.new("RGB", (700, 350), color="white")
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=28)
    lines = [
        "INVOICE",
        "Invoice No: INV-2026-0099",
        "Invoice Date: 18/11/2026",
        "GSTIN: 27AAACC1206D1ZG",
        "Vendor: Acme Supplies Pvt Ltd",
        "Total Amount: 5,000.00",
    ]
    y = 10
    for line in lines:
        draw.text((20, y), line, fill="black", font=font)
        y += 50
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return SimpleUploadedFile("valid_invoice.png", buf.getvalue(), content_type="image/png")


@pytest.fixture
def known_vendor_for_sample_invoice(db):
    from vendors.models import Vendor

    return Vendor.objects.create(
        name="Acme Supplies Pvt Ltd",
        gstin="27AAACC1206D1ZG",
        email="billing@acme.test",
        bank_account_number="1234567890",
        bank_ifsc="HDFC0001234",
    )
