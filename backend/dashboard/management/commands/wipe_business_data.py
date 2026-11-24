from django.core.management.base import BaseCommand
from django.db import transaction

from invoices.models import Invoice
from payments.models import Payment
from procurement.models import PurchaseOrder
from vendors.models import Vendor
from workflow.models import Notification


class Command(BaseCommand):
    """Delete every invoice, vendor, purchase order, GRN, payment and notification.

    Keeps the login accounts and the approval rule created by seed_demo intact, so
    nobody is locked out and the workflow still functions - only re-runnable test/demo
    clutter is removed. Line items, exceptions, approval steps and GRNs cascade away
    with their parent invoice/purchase order; deletion order below respects the
    PROTECT constraints (Payment -> Invoice, PurchaseOrder -> Vendor).

    Meant to be run from the Dockerfile, gated by an environment variable, for a
    deployment with no shell access - see the WIPE_BUSINESS_DATA_ON_BOOT check there.
    """

    help = "Delete all invoices, vendors, purchase orders, GRNs, payments and notifications."

    def handle(self, *args, **options):
        with transaction.atomic():
            payments, _ = Payment.objects.all().delete()
            invoices, _ = Invoice.objects.all().delete()
            purchase_orders, _ = PurchaseOrder.objects.all().delete()
            vendors, _ = Vendor.objects.all().delete()
            notifications, _ = Notification.objects.all().delete()
        self.stdout.write(self.style.SUCCESS(
            f"wipe_business_data: deleted {invoices} invoice(s), {vendors} vendor(s), "
            f"{purchase_orders} purchase order(s), {payments} payment(s), "
            f"{notifications} notification(s). Logins and the approval rule were kept."
        ))
