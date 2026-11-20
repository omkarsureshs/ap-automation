import csv

from django.http import Http404, HttpResponse
from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import HasRole
from dashboard import reports, services

# Dashboard/report data spans every vendor's GSTIN and bank-adjacent detail,
# every approver's decisions, and payment history — strictly more than the
# invoice list itself exposes (HasRole("requester","ap_admin")). Restricted
# to the two management roles, not every authenticated role (e.g. vendor).
_DASHBOARD_ROLES = ("ap_admin", "approver")

# A cell starting with one of these is a formula in Excel/Sheets when the
# CSV is opened there. Prefixing with a tab keeps the visible value intact
# while stopping it from being interpreted as a formula.
_CSV_FORMULA_PREFIXES = ("=", "+", "-", "@")


def _sanitize_csv_cell(value):
    if isinstance(value, str) and value.startswith(_CSV_FORMULA_PREFIXES):
        return "\t" + value
    return value


class SummaryView(APIView):
    permission_classes = [HasRole(*_DASHBOARD_ROLES)]

    def get(self, request):
        return Response(services.summary())


class IgnoreFormatNegotiation(DefaultContentNegotiation):
    # DRF reads ?format= as a renderer suffix (404 for "csv"); the CSV is built by the view itself.
    def select_renderer(self, request, renderers, format_suffix=None):  # JSON only
        return renderers[0], renderers[0].media_type


class ReportView(APIView):
    content_negotiation_class = IgnoreFormatNegotiation
    permission_classes = [HasRole(*_DASHBOARD_ROLES)]

    def get(self, request, kind):
        if kind not in reports.REPORTS:
            raise Http404
        columns, fn = reports.REPORTS[kind]
        rows = fn()
        if request.query_params.get("format") == "csv":
            resp = HttpResponse(content_type="text/csv")
            resp["Content-Disposition"] = f'attachment; filename="{kind}.csv"'
            w = csv.DictWriter(resp, fieldnames=columns)
            w.writeheader()
            for row in rows:
                w.writerow({k: _sanitize_csv_cell(v) for k, v in row.items()})
            return resp
        return Response(rows)
