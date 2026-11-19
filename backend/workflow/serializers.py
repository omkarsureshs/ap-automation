from rest_framework import serializers

from workflow.models import ApprovalStep, Notification


class ApprovalStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalStep
        fields = [
            "id", "invoice", "rule", "sequence_order", "approver_role",
            "status", "assigned_at", "decided_at", "decided_by",
        ]
        read_only_fields = fields


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "message", "is_read", "created_at"]
        read_only_fields = fields
