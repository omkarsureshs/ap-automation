from django.db.models import ProtectedError
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from accounts.permissions import HasRole
from workflow.models import ApprovalRule, ApprovalStep, Notification
from workflow.serializers import ApprovalRuleSerializer, ApprovalStepSerializer, NotificationSerializer
from workflow.services import AlreadyDecidedError, decide_step


class ApprovalStepViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ApprovalStepSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = ApprovalStep.objects.all()
        if self.request.query_params.get("mine") == "true":
            queryset = queryset.filter(approver_role=self.request.user.role, status=ApprovalStep.STATUS_PENDING)
        return queryset

    @action(detail=True, methods=["post"], url_path="decide")
    def decide(self, request, pk=None):
        step = self.get_object()
        if step.approver_role != request.user.role:
            return Response(status=status.HTTP_403_FORBIDDEN)

        approve_raw = request.data.get("approve")
        if approve_raw in (True, "true", "True"):
            approve = True
        elif approve_raw in (False, "false", "False"):
            approve = False
        else:
            return Response({"detail": "'approve' must be a boolean"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            step = decide_step(step, request.user, approve=approve)
        except AlreadyDecidedError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)

        return Response(ApprovalStepSerializer(step).data, status=status.HTTP_200_OK)


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Notification.objects.filter(recipient=self.request.user)
        if self.request.query_params.get("unread") == "true":
            queryset = queryset.filter(is_read=False)
        return queryset

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save()
        return Response(NotificationSerializer(notification).data, status=status.HTTP_200_OK)


class ApprovalRuleViewSet(viewsets.ModelViewSet):
    """AP Admin sets the amount-based approval matrix: who approves what, and how fast."""

    queryset = ApprovalRule.objects.all().order_by("min_amount")
    serializer_class = ApprovalRuleSerializer
    permission_classes = [HasRole("ap_admin")]

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError(
                {"detail": "This rule has approval steps on file and can't be deleted. Deactivate it instead."}
            )
