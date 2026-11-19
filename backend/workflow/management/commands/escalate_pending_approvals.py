import sys
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import User
from workflow.models import ApprovalStep
from workflow.notifications import notify

ESCALATION_TARGET_ROLE = User.ROLE_AP_ADMIN


class Command(BaseCommand):
    help = "Escalate ApprovalSteps that have been pending longer than their rule's escalation_hours."

    def handle(self, *args, **options):
        now = timezone.now()
        overdue_steps = ApprovalStep.objects.filter(status=ApprovalStep.STATUS_PENDING).select_related("rule")

        for step in overdue_steps:
            if now - step.assigned_at <= timedelta(hours=step.rule.escalation_hours):
                continue

            with transaction.atomic():
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
            for admin in admins:
                notify(admin, f"Invoice #{step.invoice_id} approval step escalated to you")
