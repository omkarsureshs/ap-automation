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
