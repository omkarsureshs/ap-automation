from django.db import models

from vendors.fields import EncryptedCharField


class Vendor(models.Model):
    name = models.CharField(max_length=255)
    gstin = models.CharField(max_length=20, unique=True)
    email = models.EmailField()
    bank_account_number = EncryptedCharField(max_length=255)
    bank_ifsc = EncryptedCharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Vendor({self.id}, {self.name!r})"
