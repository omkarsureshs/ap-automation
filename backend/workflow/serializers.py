from rest_framework import serializers

from invoices.models import Invoice
from workflow.models import ApprovalStep, Notification


class InvoiceSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = ["id", "extracted_invoice_no", "extracted_vendor_name", "extracted_total_amount", "file"]
        read_only_fields = fields


class ApprovalStepSerializer(serializers.ModelSerializer):
    invoice_detail = InvoiceSummarySerializer(source="invoice", read_only=True)

    class Meta:
        model = ApprovalStep
        fields = [
            "id", "invoice", "invoice_detail", "rule", "sequence_order", "approver_role",
            "status", "assigned_at", "decided_at", "decided_by",
        ]
        read_only_fields = fields


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "message", "is_read", "created_at"]
        read_only_fields = fields
