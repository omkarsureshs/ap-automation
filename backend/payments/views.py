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
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        invoice_id = request.data.get("invoice")
        invoice = Invoice.objects.filter(pk=invoice_id).first()
        if invoice is None:
            return Response({"invoice": ["Invoice not found."]}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)

            if Payment.objects.filter(invoice=invoice).exists():
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
