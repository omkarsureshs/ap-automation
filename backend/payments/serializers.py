from rest_framework import serializers

from payments.models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = [
            "id", "invoice", "amount", "status", "gateway_reference",
            "failure_reason", "requested_by", "requested_at", "completed_at",
        ]
        read_only_fields = fields
