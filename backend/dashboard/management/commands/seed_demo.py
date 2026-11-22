from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from invoices.gstin import _check_digit, is_valid_gstin
from invoices.models import Invoice, InvoiceException
from payments.models import Payment
from procurement.models import GoodsReceiptNote, PurchaseOrder
from vendors.models import Vendor
from workflow.models import ApprovalRule, ApprovalStep

PASSWORD = "Demo@12345"
USERS = [
    ("requester@demo.com", "requester"),
    ("approver@demo.com", "approver"),
    ("admin@demo.com", "ap_admin"),
    ("vendor@demo.com", "vendor"),
]


def make_gstin(state, pan):
    """State code + PAN + entity '1' + 'Z', then the modulo-36 checksum."""
    body = f"{state}{pan}1Z"
    g = body + _check_digit(body)
    assert is_valid_gstin(g)
    return g


VENDORS = [
    ("Acme Supplies Pvt Ltd", make_gstin("27", "AAACC1206D")),
    ("Globex Industrial Traders", make_gstin("29", "AABCG4521K")),
    ("Initech Office Solutions", make_gstin("07", "AAECI7788M")),
]

# (key, vendor idx, amount, status, age_days, exception reasons, has_po)
INVOICES = [
    ("001", 0, "12,500.00", "uploaded", 1, [], False),
    ("002", 1, "8,200.00", "extracted", 4, [], False),
    ("003", 2, "45,000.00", "needs_review", 9, ["GSTIN does not match vendor master"], True),
    ("004", 0, "23,750.50", "needs_review", 16, ["Amount exceeds PO total", "Duplicate invoice suspected"], True),
    ("005", 1, "5,400.00", "validated", 12, [], True),
    ("006", 2, "67,300.00", "validated", 25, [], True),
    ("007", 0, "91,000.00", "pending_approval", 33, [], True),
    ("008", 1, "15,999.00", "pending_approval", 48, [], True),
    ("009", 2, "30,000.00", "approved", 40, [], True),
    ("010", 0, "7,650.00", "rejected", 55, [], False),
    ("011", 1, "54,200.00", "paid", 62, [], True),
    ("012", 0, "18,900.00", "paid", 68, [], True),
]


class Command(BaseCommand):
    help = "Seed idempotent demo data (users, vendors, POs, invoices, approvals, payments)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--users-only",
            action="store_true",
            help="Only create the 4 login accounts and the approval rule -- no demo vendors/invoices/"
            "payments. For a deployed instance that should start genuinely empty, not pre-populated.",
        )

    def handle(self, *args, **opts):
        User = get_user_model()
        users = {}
        for email, role in USERS:
            u, created = User.objects.get_or_create(email=email, defaults={"role": role})
            if created:
                u.set_password(PASSWORD)
                u.save()
            users[role] = u

        rule, _ = ApprovalRule.objects.get_or_create(
            min_amount=0, max_amount=Decimal("1000000"),
            defaults={"approver_roles": ["approver"], "escalation_hours": 24},
        )

        if opts["users_only"]:
            self.stdout.write(self.style.SUCCESS(
                f"seed_demo --users-only: 4 login accounts + 1 approval rule ready. "
                f"Logins: requester/approver/admin/vendor@demo.com, password {PASSWORD}"
            ))
            return

        vendors = []
        for name, gstin in VENDORS:
            v, _ = Vendor.objects.get_or_create(
                gstin=gstin,
                defaults={"name": name, "email": "billing@" + name.split()[0].lower() + ".demo",
                          "bank_account_number": "50100123456789", "bank_ifsc": "HDFC0001234"},
            )
            vendors.append(v)

        now = timezone.now()
        created_count = 0
        for key, vi, amount, status, age, reasons, has_po in INVOICES:
            inv_no = f"DEMO-INV-{key}"
            if Invoice.objects.filter(extracted_invoice_no=inv_no).exists():
                continue
            created_count += 1
            vendor = vendors[vi]
            total = Decimal(amount.replace(",", ""))
            po = None
            if has_po:
                po, _ = PurchaseOrder.objects.get_or_create(
                    po_number=f"DEMO-PO-{key}", defaults={"vendor": vendor, "total_amount": total}
                )
                GoodsReceiptNote.objects.get_or_create(
                    grn_number=f"DEMO-GRN-{key}", defaults={"purchase_order": po, "received_amount": total}
                )
            created_at = now - timedelta(days=age)
            inv = Invoice.objects.create(
                file=f"invoices/demo-{key}.pdf",
                status=status,
                uploaded_by=users["requester"],
                raw_ocr_text=None if status == "uploaded" else f"INVOICE {inv_no} {vendor.name} Total {amount}",
                extracted_invoice_no=inv_no,
                extracted_invoice_date=created_at.strftime("%d/%m/%Y"),
                extracted_gstin=vendor.gstin,
                extracted_total_amount=amount,
                extracted_vendor_name=vendor.name,
                purchase_order=po,
                match_status=(
                    Invoice.MATCH_STATUS_MISMATCHED if reasons
                    else Invoice.MATCH_STATUS_MATCHED if po else Invoice.MATCH_STATUS_UNMATCHED
                ),
            )
            Invoice.objects.filter(pk=inv.pk).update(created_at=created_at)
            for r in reasons:
                InvoiceException.objects.create(invoice=inv, reason=r)

            if status == "pending_approval":
                ApprovalStep.objects.create(invoice=inv, rule=rule, approver_role="approver")
            elif status in ("approved", "rejected", "paid"):
                decided = created_at + timedelta(hours=18 + int(key))
                ApprovalStep.objects.create(
                    invoice=inv, rule=rule, approver_role="approver",
                    status="rejected" if status == "rejected" else "approved",
                    decided_at=decided, decided_by=users["approver"],
                )
                if status == "paid":
                    Payment.objects.create(
                        invoice=inv, amount=total, status=Payment.STATUS_COMPLETED,
                        gateway_reference=f"MOCK-{key}", requested_by=users["ap_admin"],
                        completed_at=decided + timedelta(hours=6),
                    )

        self.stdout.write(self.style.SUCCESS(
            f"seed_demo: {created_count} new invoices ({Invoice.objects.count()} total), "
            f"{Vendor.objects.count()} vendors, {Payment.objects.count()} payments. "
            f"Logins: requester/approver/admin/vendor@demo.com, password {PASSWORD}"
        ))
