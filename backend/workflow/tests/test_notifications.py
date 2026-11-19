from datetime import timedelta

import pytest
from django.core.management import call_command
from django.utils import timezone

from invoices.models import Invoice
from workflow.models import ApprovalRule, ApprovalStep, Notification
from workflow.notifications import notify
from workflow.services import start_approval


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(email="notify-me@x.com", password="pw12345!", role="approver")


@pytest.fixture
def uploader(django_user_model):
    return django_user_model.objects.create_user(email="notify-uploader@x.com", password="pw12345!", role="requester")


@pytest.fixture
def approval_rule_two_approvers(db):
    return ApprovalRule.objects.create(
        min_amount="0.00", max_amount="5000.00", approver_roles=["approver", "ap_admin"], escalation_hours=24,
    )


@pytest.fixture
def invoice(db, uploader):
    return Invoice.objects.create(file="invoices/test.pdf", uploaded_by=uploader, extracted_total_amount="1000.00")


@pytest.fixture
def overdue_pending_step(db, uploader):
    rule = ApprovalRule.objects.create(
        min_amount="0.00", max_amount="5000.00", approver_roles=["approver"], escalation_hours=24,
    )
    invoice = Invoice.objects.create(
        file="invoices/test.pdf", uploaded_by=uploader, extracted_total_amount="1000.00",
        status=Invoice.STATUS_PENDING_APPROVAL,
    )
    step = ApprovalStep.objects.create(invoice=invoice, rule=rule, approver_role="approver")
    ApprovalStep.objects.filter(pk=step.pk).update(assigned_at=timezone.now() - timedelta(hours=25))
    step.refresh_from_db()
    return step


def test_notify_creates_notification_and_sends_email(db, mailoutbox, user):
    notification = notify(user, "Hello there")
    assert isinstance(notification, Notification)
    assert notification.recipient == user
    assert notification.message == "Hello there"
    assert notification.is_read is False
    assert len(mailoutbox) == 1
    assert mailoutbox[0].to == [user.email]
    assert "Hello there" in mailoutbox[0].body


def test_notify_still_creates_notification_when_email_sending_fails(db, user, monkeypatch):
    def _raise(*args, **kwargs):
        raise OSError("SMTP connection refused")

    monkeypatch.setattr("workflow.notifications.send_mail", _raise)

    notification = notify(user, "Hello despite the outage")

    assert isinstance(notification, Notification)
    assert notification.recipient == user


def test_start_approval_notifies_each_assigned_approver(db, mailoutbox, approval_rule_two_approvers, invoice, django_user_model):
    approver_user = django_user_model.objects.create_user(email="approver1@x.com", password="pw12345!", role="approver")
    admin_user = django_user_model.objects.create_user(email="admin1@x.com", password="pw12345!", role="ap_admin")

    start_approval(invoice)

    recipients = {m.to[0] for m in mailoutbox}
    assert approver_user.email in recipients
    assert admin_user.email in recipients
    assert Notification.objects.filter(recipient=approver_user).exists()
    assert Notification.objects.filter(recipient=admin_user).exists()


def test_escalation_notifies_the_ap_admin(db, mailoutbox, overdue_pending_step, django_user_model):
    admin_user = django_user_model.objects.create_user(email="admin2@x.com", password="pw12345!", role="ap_admin")

    call_command("escalate_pending_approvals")

    assert Notification.objects.filter(recipient=admin_user).exists()
    recipients = {m.to[0] for m in mailoutbox}
    assert admin_user.email in recipients


def test_mark_read_only_affects_own_notification(auth_client_requester, django_user_model):
    other_user = django_user_model.objects.create_user(email="other@x.com", password="pw12345!", role="requester")
    other_users_notification = Notification.objects.create(recipient=other_user, message="not yours")

    resp = auth_client_requester.post(f"/api/workflow/notifications/{other_users_notification.id}/mark-read/")
    assert resp.status_code == 404
    other_users_notification.refresh_from_db()
    assert other_users_notification.is_read is False
