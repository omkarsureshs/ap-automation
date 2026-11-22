from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone

from invoices.models import Invoice
from workflow.models import ApprovalRule, ApprovalStep


@pytest.fixture
def uploader(django_user_model):
    return django_user_model.objects.create_user(email="rem-uploader@x.com", password="pw12345!", role="requester")


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


def _step_assigned(invoice, rule, hours_ago):
    step = ApprovalStep.objects.create(invoice=invoice, rule=rule, approver_role="approver")
    ApprovalStep.objects.filter(pk=step.pk).update(assigned_at=timezone.now() - timedelta(hours=hours_ago))
    step.refresh_from_db()
    return step


def test_reminder_sent_for_step_past_halfway_point(db, invoice, rule, django_user_model):
    django_user_model.objects.create_user(email="approver-rem@x.com", password="pw12345!", role="approver")
    step = _step_assigned(invoice, rule, hours_ago=13)  # halfway is 12h for a 24h rule

    call_command("send_approval_reminders")

    step.refresh_from_db()
    assert step.reminder_sent_at is not None
    assert step.status == ApprovalStep.STATUS_PENDING  # reminder never changes status


def test_no_reminder_before_halfway_point(db, invoice, rule):
    step = _step_assigned(invoice, rule, hours_ago=5)  # well before the 12h halfway mark

    call_command("send_approval_reminders")

    step.refresh_from_db()
    assert step.reminder_sent_at is None


def test_reminder_not_sent_twice(db, invoice, rule, django_user_model):
    django_user_model.objects.create_user(email="approver-rem2@x.com", password="pw12345!", role="approver")
    step = _step_assigned(invoice, rule, hours_ago=13)

    call_command("send_approval_reminders")
    step.refresh_from_db()
    first_sent_at = step.reminder_sent_at
    assert first_sent_at is not None

    call_command("send_approval_reminders")
    step.refresh_from_db()
    assert step.reminder_sent_at == first_sent_at  # unchanged, not resent


def test_no_reminder_once_past_the_escalation_deadline(db, invoice, rule):
    # escalate_pending_approvals owns steps this far overdue, not reminders
    step = _step_assigned(invoice, rule, hours_ago=25)

    call_command("send_approval_reminders")

    step.refresh_from_db()
    assert step.reminder_sent_at is None
