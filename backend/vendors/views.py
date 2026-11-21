from django.db.models import ProtectedError
from rest_framework import permissions, viewsets
from rest_framework.exceptions import ValidationError

from accounts.permissions import HasRole
from vendors.models import Vendor
from vendors.serializers import VendorSerializer


class VendorViewSet(viewsets.ModelViewSet):
    queryset = Vendor.objects.all()
    serializer_class = VendorSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [HasRole("ap_admin")()]
        return [permissions.IsAuthenticated()]

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError(
                {"detail": "This vendor has purchase orders on file and can't be deleted. Deactivate it instead."}
            )
