import pytest

from invoices.models import Invoice
from workflow.models import ApprovalRule, ApprovalStep
from workflow.services import start_approval


@pytest.fixture
def uploader(django_user_model):
    return django_user_model.objects.create_user(email="wf-uploader@x.com", password="pw12345!", role="requester")


def _invoice(uploader, amount="1000.00"):
    return Invoice.objects.create(file="invoices/test.pdf", uploaded_by=uploader, extracted_total_amount=amount)


@pytest.fixture
def approval_rule_single_approver(db):
    return ApprovalRule.objects.create(
        min_amount="0.00", max_amount="5000.00", approver_roles=["approver"], escalation_hours=24,
    )


@pytest.fixture
def approval_rule_two_approvers(db):
    return ApprovalRule.objects.create(
        min_amount="5000.00", max_amount="100000.00", approver_roles=["approver", "ap_admin"], escalation_hours=12,
    )


@pytest.fixture
def invoice(db, uploader):
    return _invoice(uploader, amount="1000.00")


@pytest.fixture
def invoice_with_amount_outside_any_rule(db, uploader, approval_rule_single_approver):
    return _invoice(uploader, amount="999999.00")


def test_start_approval_creates_one_step_per_configured_role(approval_rule_single_approver, invoice):
    steps = start_approval(invoice)
    assert len(steps) == 1
    assert steps[0].approver_role == "approver"
    assert steps[0].status == "pending"


def test_start_approval_creates_parallel_steps_for_multi_role_rule(approval_rule_two_approvers, uploader):
    invoice = _invoice(uploader, amount="10000.00")
    steps = start_approval(invoice)
    assert len(steps) == 2
    roles = {s.approver_role for s in steps}
    assert roles == {"approver", "ap_admin"}
    assert all(s.status == "pending" for s in steps)
    assert ApprovalStep.objects.filter(invoice=invoice).count() == 2


def test_start_approval_with_no_matching_rule_raises(invoice_with_amount_outside_any_rule):
    with pytest.raises(ValueError):
        start_approval(invoice_with_amount_outside_any_rule)
