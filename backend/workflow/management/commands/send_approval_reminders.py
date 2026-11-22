from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from invoices.models import Invoice
from workflow.models import ApprovalStep
from workflow.notifications import notify


class Command(BaseCommand):
    """Nudge approvers once, halfway through a step's escalation window.

    Separate from escalate_pending_approvals: that command reassigns the
    step once it's fully overdue; this one just reminds the original
    approver(s) while there's still time to act, so a step isn't a total
    surprise the moment it escalates.
    """

    help = "Send a one-time reminder for ApprovalSteps halfway to their escalation deadline."

    def handle(self, *args, **options):
        now = timezone.now()
        candidates = ApprovalStep.objects.filter(
            status=ApprovalStep.STATUS_PENDING,
            invoice__status=Invoice.STATUS_PENDING_APPROVAL,
            reminder_sent_at__isnull=True,
        ).select_related("rule")

        sent = 0
        for step in candidates:
            halfway = step.assigned_at + timedelta(hours=step.rule.escalation_hours / 2)
            deadline = step.assigned_at + timedelta(hours=step.rule.escalation_hours)
            if not (halfway <= now < deadline):
                continue

            with transaction.atomic():
                locked = ApprovalStep.objects.select_for_update().get(pk=step.pk)
                if locked.status != ApprovalStep.STATUS_PENDING or locked.reminder_sent_at is not None:
                    continue
                locked.reminder_sent_at = now
                locked.save(update_fields=["reminder_sent_at"])

            for approver in User.objects.filter(role=step.approver_role, is_active=True):
                notify(approver, f"Reminder: invoice #{step.invoice_id} is still waiting for your approval")
            sent += 1

        self.stdout.write(self.style.SUCCESS(f"send_approval_reminders: {sent} reminder(s) sent"))
