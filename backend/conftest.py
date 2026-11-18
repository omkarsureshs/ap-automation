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
