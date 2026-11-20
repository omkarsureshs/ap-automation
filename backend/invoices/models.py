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
    STATUS_PENDING_APPROVAL = "pending_approval"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_PAID = "paid"
    STATUS_CHOICES = [
        (STATUS_UPLOADED, "Uploaded"),
        (STATUS_EXTRACTED, "Extracted"),
        (STATUS_NEEDS_REVIEW, "Needs Review"),
        (STATUS_VALIDATED, "Validated"),
        (STATUS_PENDING_APPROVAL, "Pending Approval"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_PAID, "Paid"),
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

    MATCH_STATUS_UNMATCHED = "unmatched"
    MATCH_STATUS_MATCHED = "matched"
    MATCH_STATUS_MISMATCHED = "mismatched"
    MATCH_STATUS_CHOICES = [
        (MATCH_STATUS_UNMATCHED, "Unmatched"),
        (MATCH_STATUS_MATCHED, "Matched"),
        (MATCH_STATUS_MISMATCHED, "Mismatched"),
    ]

    purchase_order = models.ForeignKey(
        "procurement.PurchaseOrder", null=True, blank=True, on_delete=models.SET_NULL, related_name="invoices"
    )
    match_status = models.CharField(max_length=20, choices=MATCH_STATUS_CHOICES, default=MATCH_STATUS_UNMATCHED)

    def __str__(self):
        return f"Invoice({self.id}, {self.status})"


class InvoiceException(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="exceptions")
    reason = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"InvoiceException(invoice={self.invoice_id}, reason={self.reason!r})"
