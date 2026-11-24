import re

from rest_framework import serializers

from accounts.models import User
from invoices.gstin import is_valid_gstin
from vendors.models import Vendor

_IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
_BANK_ACCOUNT_RE = re.compile(r"^\d{9,18}$")


class VendorSerializer(serializers.ModelSerializer):
    bank_account_number = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = [
            "id", "name", "gstin", "email",
            "bank_account_number", "bank_ifsc", "is_active", "created_at",
        ]
        extra_kwargs = {"bank_ifsc": {"write_only": True}}

    def get_bank_account_number(self, obj):
        request = self.context.get("request")
        if request and request.user.role == User.ROLE_AP_ADMIN:
            return obj.bank_account_number
        return f"****{obj.bank_account_number[-4:]}"

    def validate_gstin(self, value):
        if not is_valid_gstin(value):
            raise serializers.ValidationError("Not a valid GSTIN (15 characters, invalid format or checksum).")
        return value

    def validate_bank_ifsc(self, value):
        if not _IFSC_RE.match(value):
            raise serializers.ValidationError(
                "Not a valid IFSC code (4 letters, then '0', then 6 letters/digits — e.g. HDFC0001234)."
            )
        return value

    def validate(self, attrs):
        # bank_account_number is a SerializerMethodField (for masked reads), so it never
        # reaches validated_data on write — it has to be checked here against raw input.
        account_number = self.initial_data.get("bank_account_number")
        if account_number is not None or self.instance is None:
            if not account_number or not _BANK_ACCOUNT_RE.match(str(account_number)):
                raise serializers.ValidationError(
                    {"bank_account_number": "Must be 9 to 18 digits."}
                )
        return attrs

    def create(self, validated_data):
        account_number = self.initial_data.get("bank_account_number")
        return Vendor.objects.create(bank_account_number=account_number, **validated_data)

    def update(self, instance, validated_data):
        account_number = self.initial_data.get("bank_account_number")
        if account_number:
            instance.bank_account_number = account_number
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return instance
