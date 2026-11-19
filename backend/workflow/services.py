from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from invoices.models import Invoice, InvoiceException
from workflow.models import ApprovalRule, ApprovalStep
from workflow.notifications import notify


class AlreadyDecidedError(Exception):
    pass


def start_approval(invoice: Invoice) -> list[ApprovalStep]:
    from django.apps import apps

    User = apps.get_model(settings.AUTH_USER_MODEL)

    amount = Decimal(invoice.extracted_total_amount.replace(",", ""))
    rule = (
        ApprovalRule.objects.filter(is_active=True, min_amount__lte=amount, max_amount__gt=amount)
        .order_by("min_amount")
        .first()
    )
    if rule is None:
        raise ValueError(f"No approval rule covers amount {amount}")

    steps = [
        ApprovalStep.objects.create(invoice=invoice, rule=rule, sequence_order=i, approver_role=role)
        for i, role in enumerate(rule.approver_roles)
    ]

    for step in steps:
        approvers = User.objects.filter(role=step.approver_role, is_active=True)
        if not approvers.exists():
            InvoiceException.objects.create(
                invoice=invoice, reason=f"No active {step.approver_role} user to approve this invoice"[:255]
            )
        for approver in approvers:
            notify(approver, f"Invoice #{invoice.pk} is waiting for your approval")

    return steps


def decide_step(step: ApprovalStep, user, approve: bool) -> ApprovalStep:
    from django.db import transaction

    with transaction.atomic():
        step = ApprovalStep.objects.select_for_update().get(pk=step.pk)
        if step.status != ApprovalStep.STATUS_PENDING:
            raise AlreadyDecidedError(f"Step {step.pk} is already {step.status}")

        # Lock the invoice row too: two approvers deciding their own parallel
        # steps at nearly the same instant both need to see each other's
        # decision before checking whether every step is now resolved.
        invoice = Invoice.objects.select_for_update().get(pk=step.invoice_id)

        step.status = ApprovalStep.STATUS_APPROVED if approve else ApprovalStep.STATUS_REJECTED
        step.decided_at = timezone.now()
        step.decided_by = user
        step.save()

        if not approve:
            invoice.approval_steps.filter(status=ApprovalStep.STATUS_PENDING).update(
                status=ApprovalStep.STATUS_REJECTED
            )
            invoice.status = Invoice.STATUS_REJECTED
            invoice.save()
        elif not invoice.approval_steps.exclude(
            status__in=[ApprovalStep.STATUS_APPROVED, ApprovalStep.STATUS_ESCALATED]
        ).exists():
            invoice.status = Invoice.STATUS_APPROVED
            invoice.save()

    return step
