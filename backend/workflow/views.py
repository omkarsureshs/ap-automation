from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from workflow.models import ApprovalStep
from workflow.serializers import ApprovalStepSerializer
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

        approve = request.data.get("approve") in (True, "true", "True", "1", 1)
        try:
            step = decide_step(step, request.user, approve=approve)
        except AlreadyDecidedError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)

        return Response(ApprovalStepSerializer(step).data, status=status.HTTP_200_OK)
