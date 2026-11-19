from rest_framework import serializers

from procurement.models import GoodsReceiptNote, PurchaseOrder


class PurchaseOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrder
        fields = ["id", "po_number", "vendor", "total_amount", "created_at"]


class GoodsReceiptNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoodsReceiptNote
        fields = ["id", "grn_number", "purchase_order", "received_amount", "created_at"]
