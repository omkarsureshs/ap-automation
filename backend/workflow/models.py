from django.conf import settings
from django.db import models

from invoices.models import Invoice


class ApprovalRule(models.Model):
    min_amount = models.DecimalField(max_digits=14, decimal_places=2)
    max_amount = models.DecimalField(max_digits=14, decimal_places=2)
    approver_roles = models.JSONField()
    escalation_hours = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"ApprovalRule({self.min_amount}-{self.max_amount}, {self.approver_roles})"


class ApprovalStep(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_ESCALATED = "escalated"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_ESCALATED, "Escalated"),
    ]

    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="approval_steps")
    rule = models.ForeignKey(ApprovalRule, on_delete=models.PROTECT, related_name="steps")
    sequence_order = models.PositiveIntegerField(default=0)
    approver_role = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    assigned_at = models.DateTimeField(auto_now_add=True)
    reminder_sent_at = models.DateTimeField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="decided_steps"
    )

    def __str__(self):
        return f"ApprovalStep(invoice={self.invoice_id}, role={self.approver_role}, status={self.status})"


class Notification(models.Model):
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    message = models.CharField(max_length=500)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Notification(recipient={self.recipient_id}, read={self.is_read})"
