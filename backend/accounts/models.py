from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, role=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        if not role:
            raise ValueError("Users must have a role")
        user = self.model(email=self.normalize_email(email), role=role, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, role="ap_admin", **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, role, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_REQUESTER = "requester"
    ROLE_APPROVER = "approver"
    ROLE_AP_ADMIN = "ap_admin"
    ROLE_VENDOR = "vendor"
    ROLE_CHOICES = [
        (ROLE_REQUESTER, "Requester"),
        (ROLE_APPROVER, "Approver"),
        (ROLE_AP_ADMIN, "AP Admin"),
        (ROLE_VENDOR, "Vendor"),
    ]

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["role"]

    def __str__(self):
        return self.email
