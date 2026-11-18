import pytest


@pytest.mark.django_db
def test_register_creates_user_with_role(client):
    resp = client.post("/api/auth/register/", {"email": "r@x.com", "password": "pw12345!", "role": "requester"})
    assert resp.status_code == 201


def test_login_returns_access_and_refresh_tokens(client, django_user_model):
    django_user_model.objects.create_user(email="a@x.com", password="pw12345!", role="approver")
    resp = client.post("/api/auth/login/", {"email": "a@x.com", "password": "pw12345!"})
    assert resp.status_code == 200
    assert "access" in resp.json() and "refresh" in resp.json()


def test_has_role_permission_rejects_wrong_role(client, django_user_model):
    django_user_model.objects.create_user(email="v@x.com", password="pw12345!", role="vendor")
    login = client.post("/api/auth/login/", {"email": "v@x.com", "password": "pw12345!"}).json()
    resp = client.get("/api/invoices/", HTTP_AUTHORIZATION=f"Bearer {login['access']}")
    assert resp.status_code == 403
