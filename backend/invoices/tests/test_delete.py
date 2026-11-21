import pytest

from invoices.models import Invoice


def _invoice(django_user_model, status):
    user = django_user_model.objects.create_user(email="uploader-del@x.com", password="pw12345!", role="requester")
    return Invoice.objects.create(file="invoices/delete-test.pdf", uploaded_by=user, status=status)


@pytest.mark.django_db
def test_ap_admin_can_delete_a_needs_review_invoice(auth_client_ap_admin, django_user_model):
    invoice = _invoice(django_user_model, Invoice.STATUS_NEEDS_REVIEW)
    resp = auth_client_ap_admin.delete(f"/api/invoices/{invoice.id}/")
    assert resp.status_code == 204
    assert not Invoice.objects.filter(id=invoice.id).exists()


@pytest.mark.django_db
def test_cannot_delete_an_approved_invoice(auth_client_ap_admin, django_user_model):
    invoice = _invoice(django_user_model, Invoice.STATUS_APPROVED)
    resp = auth_client_ap_admin.delete(f"/api/invoices/{invoice.id}/")
    assert resp.status_code == 400
    assert Invoice.objects.filter(id=invoice.id).exists()


@pytest.mark.django_db
def test_requester_cannot_delete_invoice(auth_client_requester, django_user_model):
    invoice = _invoice(django_user_model, Invoice.STATUS_UPLOADED)
    resp = auth_client_requester.delete(f"/api/invoices/{invoice.id}/")
    assert resp.status_code == 403
    assert Invoice.objects.filter(id=invoice.id).exists()
