from collections import defaultdict
from decimal import Decimal, InvalidOperation

from django.db.models import Count, Max
from django.utils import timezone

from invoices.models import Invoice
from payments.models import Payment
from workflow.models import ApprovalStep

BUCKETS = ["0-7 days", "8-30 days", "31-60 days", "60+ days"]
UNPAID_EXCLUDED = (Invoice.STATUS_PAID, Invoice.STATUS_REJECTED)


def parse_amount(value):
    """Parse an OCR'd amount string ("1,234.50"); unparsable/None -> Decimal(0)."""
    try:
        d = Decimal(str(value).replace(",", "").strip())
        return d if d.is_finite() else Decimal(0)
    except (InvalidOperation, ValueError):
        return Decimal(0)


def bucket_for(age_days):
    if age_days <= 7:
        return BUCKETS[0]
    if age_days <= 30:
        return BUCKETS[1]
    if age_days <= 60:
        return BUCKETS[2]
    return BUCKETS[3]


def _money(d):
    return str(Decimal(d).quantize(Decimal("0.01")))


def invoice_aging():
    now = timezone.now()
    agg = {b: [0, Decimal(0)] for b in BUCKETS}
    for inv in Invoice.objects.exclude(status__in=UNPAID_EXCLUDED):
        a = agg[bucket_for((now - inv.created_at).days)]
        a[0] += 1
        a[1] += parse_amount(inv.extracted_total_amount)
    return [{"bucket": b, "count": agg[b][0], "total_amount": _money(agg[b][1])} for b in BUCKETS]


def avg_turnaround_hours():
    done = Invoice.objects.filter(
        status__in=[Invoice.STATUS_APPROVED, Invoice.STATUS_REJECTED, Invoice.STATUS_PAID]
    ).annotate(last_decision=Max("approval_steps__decided_at"))
    payments = dict(Payment.objects.exclude(completed_at=None).values_list("invoice_id", "completed_at"))
    hours = []
    for inv in done:
        end = payments.get(inv.id) if inv.status == Invoice.STATUS_PAID else None
        end = end or inv.last_decision
        if end:
            hours.append((end - inv.created_at).total_seconds() / 3600)
    return round(sum(hours) / len(hours), 2) if hours else None


def ocr_accuracy_percent():
    """Straight-through OCR rate: 100 * A / B where
    B = invoices that completed OCR (raw_ocr_text is not null) and
    A = those of B that reached validated / pending_approval / approved / paid
        AND have no InvoiceException rows (i.e. needed no manual correction).
    Returns None when B == 0.
    """
    ocr_done = Invoice.objects.exclude(raw_ocr_text=None)
    total = ocr_done.count()
    if not total:
        return None
    clean = (
        ocr_done.filter(
            status__in=[
                Invoice.STATUS_VALIDATED,
                Invoice.STATUS_PENDING_APPROVAL,
                Invoice.STATUS_APPROVED,
                Invoice.STATUS_PAID,
            ]
        )
        .filter(exceptions__isnull=True)
        .count()
    )
    return round(100 * clean / total, 2)


def vendor_analytics():
    totals = defaultdict(lambda: [0, Decimal(0)])
    for name, amt in Invoice.objects.exclude(extracted_vendor_name=None).values_list(
        "extracted_vendor_name", "extracted_total_amount"
    ):
        totals[name][0] += 1
        totals[name][1] += parse_amount(amt)
    top = sorted(totals.items(), key=lambda kv: (-kv[1][0], kv[0]))[:10]
    return [{"vendor_name": n, "invoice_count": c, "total_amount": _money(t)} for n, (c, t) in top]


def payment_tracking():
    counts = dict(Payment.objects.values_list("status").annotate(n=Count("id")))
    paid = sum((p.amount for p in Payment.objects.filter(status=Payment.STATUS_COMPLETED)), Decimal(0))
    return {
        "processing": counts.get(Payment.STATUS_PROCESSING, 0),
        "completed": counts.get(Payment.STATUS_COMPLETED, 0),
        "failed": counts.get(Payment.STATUS_FAILED, 0),
        "total_paid_amount": _money(paid),
    }


def summary():
    return {
        "invoice_aging": invoice_aging(),
        "pending_approvals": ApprovalStep.objects.filter(status=ApprovalStep.STATUS_PENDING).count(),
        "avg_turnaround_hours": avg_turnaround_hours(),
        "ocr_accuracy_percent": ocr_accuracy_percent(),
        "vendor_analytics": vendor_analytics(),
        "payment_tracking": payment_tracking(),
    }
