from rest_framework import permissions, viewsets

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
