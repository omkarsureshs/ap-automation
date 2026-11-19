from decimal import Decimal

from django.utils import timezone

from invoices.models import Invoice
from workflow.models import ApprovalRule, ApprovalStep


class AlreadyDecidedError(Exception):
    pass


def start_approval(invoice: Invoice) -> list[ApprovalStep]:
    amount = Decimal(invoice.extracted_total_amount.replace(",", ""))
    rule = (
        ApprovalRule.objects.filter(is_active=True, min_amount__lte=amount, max_amount__gt=amount)
        .order_by("min_amount")
        .first()
    )
    if rule is None:
        raise ValueError(f"No approval rule covers amount {amount}")

    return [
        ApprovalStep.objects.create(invoice=invoice, rule=rule, sequence_order=i, approver_role=role)
        for i, role in enumerate(rule.approver_roles)
    ]


def decide_step(step: ApprovalStep, user, approve: bool) -> ApprovalStep:
    from django.db import transaction

    with transaction.atomic():
        step = ApprovalStep.objects.select_for_update().get(pk=step.pk)
        if step.status != ApprovalStep.STATUS_PENDING:
            raise AlreadyDecidedError(f"Step {step.pk} is already {step.status}")

        step.status = ApprovalStep.STATUS_APPROVED if approve else ApprovalStep.STATUS_REJECTED
        step.decided_at = timezone.now()
        step.decided_by = user
        step.save()

        invoice = step.invoice
        if not approve:
            invoice.status = Invoice.STATUS_REJECTED
            invoice.save()
        elif not invoice.approval_steps.exclude(status=ApprovalStep.STATUS_APPROVED).exists():
            invoice.status = Invoice.STATUS_APPROVED
            invoice.save()

    return step
