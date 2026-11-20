from django.contrib import admin

from payments.models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("invoice", "amount", "status", "gateway_reference", "requested_at", "completed_at")
    list_filter = ("status",)
