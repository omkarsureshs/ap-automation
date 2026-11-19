from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone

from invoices.models import Invoice
from workflow.models import ApprovalRule, ApprovalStep


@pytest.fixture
def uploader(django_user_model):
    return django_user_model.objects.create_user(email="esc-uploader@x.com", password="pw12345!", role="requester")


@pytest.fixture
def rule(db):
    return ApprovalRule.objects.create(
        min_amount="0.00", max_amount="5000.00", approver_roles=["approver"], escalation_hours=24,
    )


@pytest.fixture
def invoice(db, uploader):
    return Invoice.objects.create(
        file="invoices/test.pdf", uploaded_by=uploader, extracted_total_amount="1000.00",
        status=Invoice.STATUS_PENDING_APPROVAL,
    )


@pytest.fixture
def overdue_pending_step(db, invoice, rule):
    step = ApprovalStep.objects.create(invoice=invoice, rule=rule, approver_role="approver")
    ApprovalStep.objects.filter(pk=step.pk).update(assigned_at=timezone.now() - timedelta(hours=25))
    step.refresh_from_db()
    return step


@pytest.fixture
def fresh_pending_step(db, invoice, rule):
    return ApprovalStep.objects.create(invoice=invoice, rule=rule, approver_role="approver")


def test_escalate_marks_overdue_pending_step_escalated_and_creates_ap_admin_step(
    db, overdue_pending_step, django_user_model
):
    django_user_model.objects.create_user(email="admin@x.com", password="pw12345!", role="ap_admin")

    call_command("escalate_pending_approvals")

    overdue_pending_step.refresh_from_db()
    assert overdue_pending_step.status == ApprovalStep.STATUS_ESCALATED
    new_step = ApprovalStep.objects.filter(
        invoice=overdue_pending_step.invoice, approver_role="ap_admin"
    ).first()
    assert new_step is not None
    assert new_step.status == ApprovalStep.STATUS_PENDING


def test_escalate_leaves_fresh_pending_step_untouched(db, fresh_pending_step):
    call_command("escalate_pending_approvals")

    fresh_pending_step.refresh_from_db()
    assert fresh_pending_step.status == ApprovalStep.STATUS_PENDING
    assert not ApprovalStep.objects.filter(
        invoice=fresh_pending_step.invoice, approver_role="ap_admin"
    ).exists()


def test_escalate_warns_when_no_active_ap_admin_exists(db, overdue_pending_step, capsys):
    call_command("escalate_pending_approvals")

    overdue_pending_step.refresh_from_db()
    assert overdue_pending_step.status == ApprovalStep.STATUS_ESCALATED
    captured = capsys.readouterr()
    assert "no active ap_admin" in captured.err.lower()
