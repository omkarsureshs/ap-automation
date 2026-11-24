from rest_framework.routers import DefaultRouter

from workflow.views import ApprovalRuleViewSet, ApprovalStepViewSet, NotificationViewSet

router = DefaultRouter()
router.register("approvals", ApprovalStepViewSet, basename="approval")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("approval-rules", ApprovalRuleViewSet, basename="approval-rule")

urlpatterns = router.urls
