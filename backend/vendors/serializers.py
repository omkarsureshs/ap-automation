from rest_framework import serializers

from accounts.models import User
from vendors.models import Vendor


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
