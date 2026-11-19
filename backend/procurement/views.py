from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import HasRole
from procurement.csv_import import import_grns_csv, import_purchase_orders_csv
from procurement.models import GoodsReceiptNote, PurchaseOrder
from procurement.serializers import GoodsReceiptNoteSerializer, PurchaseOrderSerializer


class _WriteRestrictedViewSet(viewsets.ModelViewSet):
    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "import_csv"):
            return [HasRole("ap_admin")()]
        return [permissions.IsAuthenticated()]


class PurchaseOrderViewSet(_WriteRestrictedViewSet):
    queryset = PurchaseOrder.objects.all()
    serializer_class = PurchaseOrderSerializer

    @action(detail=False, methods=["post"], url_path="import-csv")
    def import_csv(self, request):
        result = import_purchase_orders_csv(request.FILES["file"])
        return Response(result, status=status.HTTP_200_OK)


class GoodsReceiptNoteViewSet(_WriteRestrictedViewSet):
    queryset = GoodsReceiptNote.objects.all()
    serializer_class = GoodsReceiptNoteSerializer

    @action(detail=False, methods=["post"], url_path="import-csv")
    def import_csv(self, request):
        result = import_grns_csv(request.FILES["file"])
        return Response(result, status=status.HTTP_200_OK)
