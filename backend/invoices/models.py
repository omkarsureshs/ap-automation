from django.conf import settings
from django.db import models


def invoice_upload_path(instance, filename):
    return f"invoices/{filename}"


class Invoice(models.Model):
    SOURCE_MANUAL = "manual"
    SOURCE_EMAIL = "email"
    SOURCE_CHOICES = [(SOURCE_MANUAL, "Manual"), (SOURCE_EMAIL, "Email")]

    STATUS_UPLOADED = "uploaded"
    STATUS_EXTRACTED = "extracted"
    STATUS_NEEDS_REVIEW = "needs_review"
    STATUS_VALIDATED = "validated"
    STATUS_CHOICES = [
        (STATUS_UPLOADED, "Uploaded"),
        (STATUS_EXTRACTED, "Extracted"),
        (STATUS_NEEDS_REVIEW, "Needs Review"),
        (STATUS_VALIDATED, "Validated"),
    ]

    file = models.FileField(upload_to=invoice_upload_path)
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default=SOURCE_MANUAL)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_UPLOADED)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="invoices")
    raw_ocr_text = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    extracted_invoice_no = models.CharField(max_length=100, null=True, blank=True)
    extracted_invoice_date = models.CharField(max_length=50, null=True, blank=True)
    extracted_gstin = models.CharField(max_length=20, null=True, blank=True)
    extracted_total_amount = models.CharField(max_length=50, null=True, blank=True)
    extracted_vendor_name = models.CharField(max_length=255, null=True, blank=True)

    def __str__(self):
        return f"Invoice({self.id}, {self.status})"
