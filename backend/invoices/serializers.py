from rest_framework import serializers

from invoices.models import Invoice, InvoiceException

ALLOWED_EXTENSIONS = (".pdf", ".png", ".jpg", ".jpeg")


class InvoiceExceptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceException
        fields = ["id", "reason", "created_at"]


class InvoiceSerializer(serializers.ModelSerializer):
    exceptions = InvoiceExceptionSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = ["id", "file", "source", "status", "uploaded_by", "raw_ocr_text", "created_at", "exceptions"]
        read_only_fields = ["status", "uploaded_by", "raw_ocr_text", "created_at"]

    def validate_file(self, value):
        name = value.name.lower()
        if not name.endswith(ALLOWED_EXTENSIONS):
            raise serializers.ValidationError("File must be a PDF or image (.pdf, .png, .jpg, .jpeg).")
        if value.size == 0:
            raise serializers.ValidationError("File must not be empty.")
        return value

    def create(self, validated_data):
        validated_data["uploaded_by"] = self.context["request"].user
        return super().create(validated_data)
