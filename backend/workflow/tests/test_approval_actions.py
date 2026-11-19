import pytest

from invoices.models import Invoice
from workflow.models import ApprovalRule, ApprovalStep
from workflow.services import AlreadyDecidedError, decide_step


@pytest.fixture
def uploader(django_user_model):
    return django_user_model.objects.create_user(email="wf-uploader2@x.com", password="pw12345!", role="requester")


@pytest.fixture
def approver_user(django_user_model):
    return django_user_model.objects.create_user(email="wf-approver@x.com", password="pw12345!", role="approver")


@pytest.fixture
def rule_single(db):
    return ApprovalRule.objects.create(
        min_amount="0.00", max_amount="5000.00", approver_roles=["approver"], escalation_hours=24,
    )


@pytest.fixture
def rule_two(db):
    return ApprovalRule.objects.create(
        min_amount="0.00", max_amount="5000.00", approver_roles=["approver", "ap_admin"], escalation_hours=24,
    )


@pytest.fixture
def invoice_pending(db, uploader):
    return Invoice.objects.create(
        file="invoices/test.pdf", uploaded_by=uploader, extracted_total_amount="1000.00",
        status=Invoice.STATUS_PENDING_APPROVAL,
    )


@pytest.fixture
def pending_step(db, invoice_pending, rule_single):
    return ApprovalStep.objects.create(invoice=invoice_pending, rule=rule_single, approver_role="approver")


@pytest.fixture
def approved_step(db, invoice_pending, rule_single, approver_user):
    return ApprovalStep.objects.create(
        invoice=invoice_pending, rule=rule_single, approver_role="approver",
        status=ApprovalStep.STATUS_APPROVED, decided_by=approver_user,
    )


@pytest.fixture
def invoice_with_two_pending_steps(db, uploader, rule_two):
    invoice = Invoice.objects.create(
        file="invoices/test.pdf", uploaded_by=uploader, extracted_total_amount="1000.00",
        status=Invoice.STATUS_PENDING_APPROVAL,
    )
    step1 = ApprovalStep.objects.create(invoice=invoice, rule=rule_two, approver_role="approver")
    step2 = ApprovalStep.objects.create(invoice=invoice, rule=rule_two, approver_role="ap_admin")
    return invoice, step1, step2


def test_approver_can_approve_own_pending_step(auth_client_approver, pending_step):
    resp = auth_client_approver.post(f"/api/workflow/approvals/{pending_step.id}/decide/", {"approve": True})
    assert resp.status_code == 200
    pending_step.refresh_from_db()
    assert pending_step.status == "approved"


def test_wrong_role_cannot_decide_step(auth_client_requester, pending_step):
    resp = auth_client_requester.post(f"/api/workflow/approvals/{pending_step.id}/decide/", {"approve": True})
    assert resp.status_code == 403


def test_my_approvals_list_includes_invoice_summary(auth_client_approver, pending_step):
    resp = auth_client_approver.get("/api/workflow/approvals/?mine=true")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    invoice_summary = body[0]["invoice_detail"]
    assert invoice_summary["id"] == pending_step.invoice_id
    assert invoice_summary["extracted_total_amount"] == "1000.00"


def test_decide_with_missing_approve_field_returns_400_not_a_silent_reject(auth_client_approver, pending_step):
    resp = auth_client_approver.post(f"/api/workflow/approvals/{pending_step.id}/decide/", {})
    assert resp.status_code == 400
    pending_step.refresh_from_db()
    assert pending_step.status == "pending"


def test_deciding_an_already_decided_step_raises_already_decided_error(db, approved_step, approver_user):
    with pytest.raises(AlreadyDecidedError):
        decide_step(approved_step, approver_user, approve=True)


def test_invoice_status_becomes_approved_once_every_step_is_approved(invoice_with_two_pending_steps, approver_user):
    invoice, step1, step2 = invoice_with_two_pending_steps
    decide_step(step1, approver_user, approve=True)
    invoice.refresh_from_db()
    assert invoice.status == Invoice.STATUS_PENDING_APPROVAL

    decide_step(step2, approver_user, approve=True)
    invoice.refresh_from_db()
    assert invoice.status == Invoice.STATUS_APPROVED


def test_invoice_status_becomes_rejected_when_any_step_is_rejected(invoice_with_two_pending_steps, approver_user):
    invoice, step1, step2 = invoice_with_two_pending_steps
    decide_step(step1, approver_user, approve=False)
    invoice.refresh_from_db()
    assert invoice.status == Invoice.STATUS_REJECTED


def test_invoice_becomes_approved_after_escalated_step_approved_by_new_assignee(
    db, invoice_pending, rule_single, approver_user, django_user_model
):
    admin_user = django_user_model.objects.create_user(email="wf-admin@x.com", password="pw12345!", role="ap_admin")
    original_step = ApprovalStep.objects.create(invoice=invoice_pending, rule=rule_single, approver_role="approver")
    original_step.status = ApprovalStep.STATUS_ESCALATED
    original_step.save()
    escalated_step = ApprovalStep.objects.create(invoice=invoice_pending, rule=rule_single, approver_role="ap_admin")

    decide_step(escalated_step, admin_user, approve=True)

    invoice_pending.refresh_from_db()
    assert invoice_pending.status == Invoice.STATUS_APPROVED


def test_rejecting_one_step_closes_other_pending_siblings(invoice_with_two_pending_steps, approver_user):
    invoice, step1, step2 = invoice_with_two_pending_steps
    decide_step(step1, approver_user, approve=False)
    step2.refresh_from_db()
    assert step2.status == ApprovalStep.STATUS_REJECTED
