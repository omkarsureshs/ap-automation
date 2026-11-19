from rest_framework.routers import DefaultRouter

from workflow.views import ApprovalStepViewSet

router = DefaultRouter()
router.register("approvals", ApprovalStepViewSet, basename="approval")

urlpatterns = router.urls
