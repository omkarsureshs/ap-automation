import logging

from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def send_payment_advice(payment) -> bool:
    """Email the vendor a payment advice once a payment completes.

    Best-effort, like workflow.notifications.notify: a failed send never
    blocks the payment itself (the Payment row is already committed by the
    time this runs). Returns whether the attempt was made at all (False
    if there's no vendor email on file to send it to).
    """
    invoice = payment.invoice
    vendor = invoice.purchase_order.vendor if invoice.purchase_order_id else None
    if vendor is None or not vendor.email:
        return False

    invoice_label = invoice.extracted_invoice_no or f"#{invoice.pk}"
    message = (
        f"Payment advice\n\n"
        f"Invoice: {invoice_label}\n"
        f"Amount paid: {payment.amount}\n"
        f"Reference: {payment.gateway_reference}\n"
        f"Date: {payment.completed_at}\n\n"
        f"This confirms payment has been made for the invoice above."
    )
    try:
        send_mail(
            subject=f"Payment advice — {invoice_label}",
            message=message,
            from_email=None,
            recipient_list=[vendor.email],
        )
    except Exception:
        logger.exception("Failed to send payment advice email to %s", vendor.email)
    return True
