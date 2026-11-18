from pathlib import Path

import pytesseract
from django.conf import settings
from pdf2image import convert_from_path
from pdf2image.exceptions import PDFInfoNotInstalledError, PDFPageCountError, PDFSyntaxError
from PIL import Image, UnidentifiedImageError
from PIL.Image import DecompressionBombError

if settings.TESSERACT_CMD:
    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD


class OcrError(Exception):
    """Raised when a file cannot be OCR'd (missing, corrupt, or unreadable)."""


def _preprocess(image):
    grayscale = image.convert("L")
    return grayscale.point(lambda pixel: 255 if pixel > 180 else 0)


def _load_pages(file_path):
    suffix = Path(file_path).suffix.lower()
    if suffix == ".pdf":
        return convert_from_path(file_path, poppler_path=settings.POPPLER_PATH)
    return [Image.open(file_path)]


def run_ocr(file_path: str) -> str:
    try:
        pages = _load_pages(file_path)
        texts = [
            pytesseract.image_to_string(_preprocess(page), config="--psm 6")
            for page in pages
        ]
    except (
        PDFPageCountError,
        PDFSyntaxError,
        PDFInfoNotInstalledError,
        UnidentifiedImageError,
        DecompressionBombError,
        pytesseract.TesseractError,
        FileNotFoundError,
        OSError,
    ) as exc:
        raise OcrError(f"Could not OCR {file_path}: {exc}") from exc
    return "\n".join(texts)
