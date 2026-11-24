from rest_framework import generics, permissions, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import HasRole
from accounts.serializers import RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({"id": request.user.id, "email": request.user.email, "role": request.user.role})


class UserViewSet(viewsets.ModelViewSet):
    """AP Admin grants/revokes role-based access and activates/deactivates accounts.

    List/retrieve/update only — account creation goes through registration,
    and deletion would orphan the invoices/payments/approvals a user is
    referenced from (several of those foreign keys are PROTECT), so
    deactivating is the supported way to remove someone's access.
    """

    queryset = User.objects.all().order_by("email")
    serializer_class = UserSerializer
    permission_classes = [HasRole("ap_admin")]
    http_method_names = ["get", "patch", "head", "options"]

    def perform_update(self, serializer):
        target = serializer.instance
        if target == self.request.user:
            new_role = serializer.validated_data.get("role")
            new_active = serializer.validated_data.get("is_active")
            if (new_role is not None and new_role != target.role) or new_active is False:
                raise ValidationError({"detail": "You can't change your own role or deactivate your own account."})
        serializer.save()
