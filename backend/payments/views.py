from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.response import Response

from accounts.permissions import HasRole
from invoices.models import Invoice
from payments.gateways import get_gateway
from payments.models import Payment
from payments.serializers import PaymentSerializer


class PaymentViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

    def get_permissions(self):
        if self.action == "create":
            return [HasRole("ap_admin")()]
        return [HasRole("ap_admin", "approver")()]

    def create(self, request, *args, **kwargs):
        invoice_id = request.data.get("invoice")
        try:
            invoice = Invoice.objects.filter(pk=invoice_id).first()
        except (ValueError, TypeError):
            return Response({"invoice": ["Invoice not found."]}, status=status.HTTP_400_BAD_REQUEST)
        if invoice is None:
            return Response({"invoice": ["Invoice not found."]}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)

            # A failed payment is not a final state — it never reached the
            # bank successfully, so the invoice must still be payable.
            # Only an in-flight or completed payment blocks a new request.
            existing = Payment.objects.filter(invoice=invoice).first()
            if existing is not None and existing.status != Payment.STATUS_FAILED:
                return Response(
                    {"detail": "A payment has already been requested for this invoice."},
                    status=status.HTTP_409_CONFLICT,
                )
            if invoice.status != Invoice.STATUS_APPROVED:
                return Response(
                    {"invoice": [f"Invoice must be approved before payment can be requested (current status: {invoice.status})."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                amount = Decimal(invoice.extracted_total_amount.replace(",", ""))
            except (InvalidOperation, AttributeError):
                return Response(
                    {"invoice": ["Invoice does not have a valid amount — cannot request payment."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not amount.is_finite() or amount <= 0:
                return Response(
                    {"invoice": ["Invoice amount must be a positive number — cannot request payment."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if existing is not None:
                # Retrying after a failure — replace the failed row rather
                # than leaving a stale one behind (invoice has a OneToOne).
                existing.delete()

            result = get_gateway().initiate_payment(amount=amount, reference=f"INV-{invoice.pk}")

            payment = Payment.objects.create(
                invoice=invoice,
                amount=amount,
                status=result.status,
                gateway_reference=result.gateway_reference,
                failure_reason=result.failure_reason or "",
                requested_by=request.user,
                completed_at=timezone.now() if result.status == Payment.STATUS_COMPLETED else None,
            )

            if result.status == Payment.STATUS_COMPLETED:
                invoice.status = Invoice.STATUS_PAID
                invoice.save()

        return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)
