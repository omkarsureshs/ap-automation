def test_upload_pdf_creates_invoice(auth_client_requester, pdf_file):
    resp = auth_client_requester.post("/api/invoices/", {"file": pdf_file}, format="multipart")
    assert resp.status_code == 201
    assert resp.json()["status"] in ("extracted", "needs_review")


def test_upload_rejects_non_pdf_image_file(auth_client_requester, txt_file):
    resp = auth_client_requester.post("/api/invoices/", {"file": txt_file}, format="multipart")
    assert resp.status_code == 400


def test_vendor_role_cannot_list_invoices(auth_client_vendor):
    resp = auth_client_vendor.get("/api/invoices/")
    assert resp.status_code == 403
