import pytest

from workflow.models import ApprovalRule


@pytest.mark.django_db
def test_ap_admin_can_create_an_approval_rule(auth_client_ap_admin):
    resp = auth_client_ap_admin.post(
        "/api/workflow/approval-rules/",
        {"min_amount": "100000.00", "max_amount": "500000.00", "approver_roles": ["approver", "ap_admin"], "escalation_hours": 48},
        format="json",
    )
    assert resp.status_code == 201
    assert ApprovalRule.objects.filter(min_amount="100000.00").exists()


@pytest.mark.django_db
def test_rule_rejects_invalid_approver_role(auth_client_ap_admin):
    resp = auth_client_ap_admin.post(
        "/api/workflow/approval-rules/",
        {"min_amount": "0.00", "max_amount": "100.00", "approver_roles": ["requester"], "escalation_hours": 24},
        format="json",
    )
    assert resp.status_code == 400
    assert "approver_roles" in resp.json()


@pytest.mark.django_db
def test_rule_rejects_min_amount_not_less_than_max_amount(auth_client_ap_admin):
    resp = auth_client_ap_admin.post(
        "/api/workflow/approval-rules/",
        {"min_amount": "500.00", "max_amount": "100.00", "approver_roles": ["approver"], "escalation_hours": 24},
        format="json",
    )
    assert resp.status_code == 400
    assert "max_amount" in resp.json()


@pytest.mark.django_db
def test_rule_rejects_non_positive_escalation_hours(auth_client_ap_admin):
    resp = auth_client_ap_admin.post(
        "/api/workflow/approval-rules/",
        {"min_amount": "0.00", "max_amount": "100.00", "approver_roles": ["approver"], "escalation_hours": 0},
        format="json",
    )
    assert resp.status_code == 400
    assert "escalation_hours" in resp.json()


@pytest.mark.django_db
def test_ap_admin_can_deactivate_a_rule_instead_of_deleting_it(auth_client_ap_admin):
    rule = ApprovalRule.objects.create(
        min_amount="0.00", max_amount="100.00", approver_roles=["approver"], escalation_hours=24
    )
    resp = auth_client_ap_admin.patch(
        f"/api/workflow/approval-rules/{rule.id}/", {"is_active": False}, format="json"
    )
    assert resp.status_code == 200
    rule.refresh_from_db()
    assert rule.is_active is False


@pytest.mark.django_db
def test_rule_with_approval_steps_on_file_cannot_be_deleted(auth_client_ap_admin, django_user_model):
    from invoices.models import Invoice
    from workflow.models import ApprovalStep

    rule = ApprovalRule.objects.create(
        min_amount="0.00", max_amount="100.00", approver_roles=["approver"], escalation_hours=24
    )
    uploader = django_user_model.objects.create_user(email="u@x.com", password="pw12345!", role="requester")
    invoice = Invoice.objects.create(file="invoices/x.pdf", uploaded_by=uploader, status=Invoice.STATUS_PENDING_APPROVAL)
    ApprovalStep.objects.create(invoice=invoice, rule=rule, approver_role="approver")

    resp = auth_client_ap_admin.delete(f"/api/workflow/approval-rules/{rule.id}/")
    assert resp.status_code == 400
    assert ApprovalRule.objects.filter(id=rule.id).exists()


@pytest.mark.django_db
def test_non_admin_cannot_manage_approval_rules(auth_client_requester):
    resp = auth_client_requester.get("/api/workflow/approval-rules/")
    assert resp.status_code == 403
