from rest_framework import generics

from accounts.permissions import HasRole
from invoices.models import Invoice
from invoices.serializers import InvoiceSerializer


class InvoiceUploadView(generics.ListCreateAPIView):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [HasRole("requester", "ap_admin")]
