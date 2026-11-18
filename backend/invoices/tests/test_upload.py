def test_upload_pdf_creates_invoice(auth_client_requester, pdf_file):
    resp = auth_client_requester.post("/api/invoices/", {"file": pdf_file}, format="multipart")
    assert resp.status_code == 201
    body = resp.json()
    # The minimal fixture PDF has no real invoice text, so OCR runs but
    # extraction finds no mandatory fields -> needs_review, with reasons.
    assert body["status"] == "needs_review"
    assert len(body["exceptions"]) > 0


def test_upload_rejects_non_pdf_image_file(auth_client_requester, txt_file):
    resp = auth_client_requester.post("/api/invoices/", {"file": txt_file}, format="multipart")
    assert resp.status_code == 400


def test_upload_rejects_exe_renamed_to_pdf(auth_client_requester, exe_renamed_to_pdf):
    resp = auth_client_requester.post("/api/invoices/", {"file": exe_renamed_to_pdf}, format="multipart")
    assert resp.status_code == 400


def test_upload_ocr_failure_creates_exception_with_reason(auth_client_requester, corrupt_pdf_with_valid_header):
    resp = auth_client_requester.post(
        "/api/invoices/", {"file": corrupt_pdf_with_valid_header}, format="multipart"
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "needs_review"
    assert len(body["exceptions"]) > 0
    assert any("ocr" in e["reason"].lower() for e in body["exceptions"])


def test_upload_real_invoice_image_reaches_validated(auth_client_requester, valid_invoice_image_file):
    resp = auth_client_requester.post("/api/invoices/", {"file": valid_invoice_image_file}, format="multipart")
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "validated"
    assert body["exceptions"] == []


def test_vendor_role_cannot_list_invoices(auth_client_vendor):
    resp = auth_client_vendor.get("/api/invoices/")
    assert resp.status_code == 403
