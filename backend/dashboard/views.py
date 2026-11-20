import csv

from django.http import Http404, HttpResponse
from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.response import Response
from rest_framework.views import APIView

from dashboard import reports, services


class SummaryView(APIView):
    def get(self, request):
        return Response(services.summary())


class IgnoreFormatNegotiation(DefaultContentNegotiation):
    # DRF reads ?format= as a renderer suffix (404 for "csv"); the CSV is built by the view itself.
    def select_renderer(self, request, renderers, format_suffix=None):  # JSON only
        return renderers[0], renderers[0].media_type


class ReportView(APIView):
    content_negotiation_class = IgnoreFormatNegotiation

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
            w.writerows(rows)
            return resp
        return Response(rows)
