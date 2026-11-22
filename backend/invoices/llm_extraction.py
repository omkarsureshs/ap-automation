import json
import logging
import os

logger = logging.getLogger(__name__)

_PROMPT = (
    "Extract the line items (materials or services billed) from this OCR'd invoice text. "
    "Reply with ONLY a JSON array, no prose, no markdown code fences. Each element: "
    '{"description": string, "quantity": string or null, "unit_price": string or null, '
    '"amount": string or null}. Keep numbers exactly as written in the text (do not compute or '
    "reformat them). If there are no clear line items, reply with exactly: []\n\n"
)


def _parse_response_text(text: str) -> list[dict]:
    """Pure parsing of whatever the model returned -- no network call, easy to unit test."""
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        items = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        return []
    if not isinstance(items, list):
        return []

    parsed = []
    for item in items:
        if not isinstance(item, dict) or not item.get("description"):
            continue
        parsed.append(
            {
                "description": str(item["description"])[:500],
                "quantity": str(item["quantity"]) if item.get("quantity") is not None else None,
                "unit_price": str(item["unit_price"]) if item.get("unit_price") is not None else None,
                "amount": str(item["amount"]) if item.get("amount") is not None else None,
            }
        )
    return parsed


def extract_line_items(raw_text: str) -> list[dict]:
    """Ask an LLM to pull structured line items out of OCR'd invoice text.

    Uses Google's Gemini API (genuinely free tier, unlike Anthropic/OpenAI
    which are pay-as-you-go). Best-effort and optional: nothing in the
    validation/matching/approval pipeline depends on this succeeding.
    Returns [] (never raises) if no API key is configured, the text is
    empty, or the call/parse fails.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or not raw_text or not raw_text.strip():
        return []

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"))
        response = model.generate_content(_PROMPT + raw_text)
        return _parse_response_text(response.text)
    except Exception:
        logger.exception("LLM line-item extraction failed")
        return []
