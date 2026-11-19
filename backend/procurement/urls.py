from rest_framework.routers import DefaultRouter

from procurement.views import GoodsReceiptNoteViewSet, PurchaseOrderViewSet

router = DefaultRouter()
router.register("purchase-orders", PurchaseOrderViewSet, basename="purchase-order")
router.register("grns", GoodsReceiptNoteViewSet, basename="grn")

urlpatterns = router.urls
