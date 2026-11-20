from django.db.models import Count
from django.utils import timezone

from dashboard.services import UNPAID_EXCLUDED, parse_amount
from invoices.models import Invoice, InvoiceException
from payments.models import Payment
from workflow.models import ApprovalStep


def _inv_no(inv):
    return inv.extracted_invoice_no or f"#{inv.id}"


def ap_aging():
    now = timezone.now()
    return [
        {
            "invoice_no": _inv_no(i),
            "vendor_name": i.extracted_vendor_name or "",
            "amount": str(parse_amount(i.extracted_total_amount)),
            "age_days": (now - i.created_at).days,
            "status": i.status,
        }
        for i in Invoice.objects.exclude(status__in=UNPAID_EXCLUDED).order_by("created_at")
    ]


def invoice_status():
    return [
        {"status": s, "count": c}
        for s, c in Invoice.objects.values_list("status").annotate(n=Count("id")).order_by("status")
    ]


def exceptions():
    return [
        {"invoice_no": _inv_no(e.invoice), "reason": e.reason, "created_at": e.created_at.isoformat()}
        for e in InvoiceException.objects.select_related("invoice").order_by("-created_at")
    ]


def audit_log():
    rows = []
    for e in InvoiceException.objects.select_related("invoice"):
        rows.append((e.created_at, "system", "exception_raised", f"{_inv_no(e.invoice)}: {e.reason}"))
    for s in ApprovalStep.objects.exclude(decided_at=None).select_related("invoice", "decided_by"):
        actor = s.decided_by.email if s.decided_by else "unknown"
        rows.append((s.decided_at, actor, f"approval_{s.status}", f"{_inv_no(s.invoice)} ({s.approver_role})"))
    paid = Payment.objects.filter(status=Payment.STATUS_COMPLETED).exclude(completed_at=None)
    for p in paid.select_related("invoice", "requested_by"):
        rows.append((p.completed_at, p.requested_by.email, "payment_completed", f"{_inv_no(p.invoice)}: {p.amount}"))
    rows.sort(key=lambda r: r[0], reverse=True)
    return [{"timestamp": t.isoformat(), "actor": a, "event": ev, "detail": d} for t, a, ev, d in rows]


def gst_tax():
    return [
        {
            "invoice_no": _inv_no(i),
            "vendor_gstin": i.extracted_gstin,
            "taxable_amount": str(parse_amount(i.extracted_total_amount)),
        }
        for i in Invoice.objects.filter(extracted_gstin__gt="", extracted_total_amount__gt="").order_by("id")
    ]


REPORTS = {
    "ap-aging": ("invoice_no vendor_name amount age_days status".split(), ap_aging),
    "invoice-status": (["status", "count"], invoice_status),
    "exceptions": (["invoice_no", "reason", "created_at"], exceptions),
    "audit-log": (["timestamp", "actor", "event", "detail"], audit_log),
    "gst-tax": (["invoice_no", "vendor_gstin", "taxable_amount"], gst_tax),
}
