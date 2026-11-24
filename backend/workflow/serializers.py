from rest_framework import serializers

from invoices.models import Invoice
from workflow.models import ApprovalRule, ApprovalStep, Notification

_APPROVER_CAPABLE_ROLES = ("approver", "ap_admin")


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


class ApprovalRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalRule
        fields = ["id", "min_amount", "max_amount", "approver_roles", "escalation_hours", "is_active"]

    def validate_approver_roles(self, value):
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError("Must be a non-empty list of roles.")
        invalid = [role for role in value if role not in _APPROVER_CAPABLE_ROLES]
        if invalid:
            raise serializers.ValidationError(
                f"Invalid role(s) {invalid}: only {list(_APPROVER_CAPABLE_ROLES)} can be assigned as "
                "approvers (a requester or vendor approving their own invoice would defeat the "
                "whole point of the approval chain)."
            )
        return value

    def validate_escalation_hours(self, value):
        if value <= 0:
            raise serializers.ValidationError("Must be a positive number of hours.")
        return value

    def validate(self, attrs):
        min_amount = attrs.get("min_amount", getattr(self.instance, "min_amount", None))
        max_amount = attrs.get("max_amount", getattr(self.instance, "max_amount", None))
        if min_amount is not None and max_amount is not None and min_amount >= max_amount:
            raise serializers.ValidationError({"max_amount": "Must be greater than min_amount."})
        return attrs
