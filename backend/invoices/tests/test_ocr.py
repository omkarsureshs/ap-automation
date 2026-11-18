import PIL.Image
import pytest

from invoices.ocr import OcrError, run_ocr


def test_run_ocr_extracts_text_from_sample_image(sample_invoice_image_path):
    text = run_ocr(sample_invoice_image_path)
    assert "INVOICE" in text.upper()


def test_run_ocr_raises_on_corrupt_file(tmp_path):
    bad = tmp_path / "bad.pdf"
    bad.write_bytes(b"not a real pdf")
    with pytest.raises(OcrError):
        run_ocr(str(bad))


def test_run_ocr_raises_ocrerror_on_decompression_bomb(sample_invoice_image_path, monkeypatch):
    # PIL's own decompression-bomb guard is a real safety check (not a
    # mock) — lowering its threshold lets us exercise it deterministically
    # without allocating an actually huge image.
    monkeypatch.setattr(PIL.Image, "MAX_IMAGE_PIXELS", 10)
    with pytest.raises(OcrError):
        run_ocr(sample_invoice_image_path)
