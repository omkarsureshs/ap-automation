from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from accounts.models import User


class RegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "password", "role"]
        extra_kwargs = {"password": {"write_only": True}, "role": {"read_only": True}}

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        # Self-registration always creates a Requester account. Elevated
        # roles (Approver, AP Admin, Vendor) are provisioned by an AP Admin,
        # not chosen by the registering client — see Day 1 final review.
        validated_data["role"] = User.ROLE_REQUESTER
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    """Lets an AP Admin see every account and change its role or active status."""

    class Meta:
        model = User
        fields = ["id", "email", "role", "is_active"]
        read_only_fields = ["id", "email"]
