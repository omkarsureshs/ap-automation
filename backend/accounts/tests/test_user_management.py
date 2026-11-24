import pytest


@pytest.mark.django_db
def test_ap_admin_can_list_users(auth_client_ap_admin, auth_client_requester):
    resp = auth_client_ap_admin.get("/api/auth/users/")
    assert resp.status_code == 200
    emails = [u["email"] for u in resp.json()]
    assert "apadmin@x.com" in emails
    assert "requester@x.com" in emails


@pytest.mark.django_db
def test_non_admin_cannot_list_users(auth_client_requester):
    resp = auth_client_requester.get("/api/auth/users/")
    assert resp.status_code == 403


@pytest.mark.django_db
def test_ap_admin_can_change_another_users_role(auth_client_ap_admin, django_user_model):
    user = django_user_model.objects.create_user(email="promote-me@x.com", password="pw12345!", role="requester")
    resp = auth_client_ap_admin.patch(f"/api/auth/users/{user.id}/", {"role": "approver"}, format="json")
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.role == "approver"


@pytest.mark.django_db
def test_ap_admin_can_deactivate_another_user(auth_client_ap_admin, django_user_model):
    user = django_user_model.objects.create_user(email="deactivate-me@x.com", password="pw12345!", role="requester")
    resp = auth_client_ap_admin.patch(f"/api/auth/users/{user.id}/", {"is_active": False}, format="json")
    assert resp.status_code == 200
    user.refresh_from_db()
    assert user.is_active is False


@pytest.mark.django_db
def test_ap_admin_cannot_change_their_own_role(auth_client_ap_admin, django_user_model):
    me = django_user_model.objects.get(email="apadmin@x.com")
    resp = auth_client_ap_admin.patch(f"/api/auth/users/{me.id}/", {"role": "requester"}, format="json")
    assert resp.status_code == 400
    me.refresh_from_db()
    assert me.role == "ap_admin"


@pytest.mark.django_db
def test_ap_admin_cannot_deactivate_their_own_account(auth_client_ap_admin, django_user_model):
    me = django_user_model.objects.get(email="apadmin@x.com")
    resp = auth_client_ap_admin.patch(f"/api/auth/users/{me.id}/", {"is_active": False}, format="json")
    assert resp.status_code == 400
    me.refresh_from_db()
    assert me.is_active is True
