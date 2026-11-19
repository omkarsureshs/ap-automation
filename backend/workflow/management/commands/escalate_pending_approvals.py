import sys
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from invoices.models import Invoice, InvoiceException
from workflow.models import ApprovalStep
from workflow.notifications import notify

ESCALATION_TARGET_ROLE = User.ROLE_AP_ADMIN


class Command(BaseCommand):
    help = "Escalate ApprovalSteps that have been pending longer than their rule's escalation_hours."

    def handle(self, *args, **options):
        now = timezone.now()
        candidate_ids = list(
            ApprovalStep.objects.filter(
                status=ApprovalStep.STATUS_PENDING, invoice__status=Invoice.STATUS_PENDING_APPROVAL
            )
            .select_related("rule")
            .values_list("pk", flat=True)
        )

        for step_id in candidate_ids:
            with transaction.atomic():
                # Re-fetch and re-check under lock: a decision could have
                # landed on this exact step since the candidate list was built.
                step = ApprovalStep.objects.select_for_update().select_related("rule").get(pk=step_id)
                if step.status != ApprovalStep.STATUS_PENDING:
                    continue
                if now - step.assigned_at <= timedelta(hours=step.rule.escalation_hours):
                    continue

                step.status = ApprovalStep.STATUS_ESCALATED
                step.save()
                ApprovalStep.objects.create(
                    invoice=step.invoice,
                    rule=step.rule,
                    sequence_order=step.sequence_order,
                    approver_role=ESCALATION_TARGET_ROLE,
                )

            admins = User.objects.filter(role=ESCALATION_TARGET_ROLE, is_active=True)
            if not admins.exists():
                print(
                    f"WARNING: no active {ESCALATION_TARGET_ROLE} user exists to receive escalated step {step.pk}",
                    file=sys.stderr,
                )
                InvoiceException.objects.create(
                    invoice=step.invoice,
                    reason=f"No active {ESCALATION_TARGET_ROLE} user to receive escalated approval"[:255],
                )
            for admin in admins:
                notify(admin, f"Invoice #{step.invoice_id} approval step escalated to you")
