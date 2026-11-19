from rest_framework.routers import DefaultRouter

from workflow.views import ApprovalStepViewSet, NotificationViewSet

router = DefaultRouter()
router.register("approvals", ApprovalStepViewSet, basename="approval")
router.register("notifications", NotificationViewSet, basename="notification")

urlpatterns = router.urls
