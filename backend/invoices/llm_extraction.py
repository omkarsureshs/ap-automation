import json
import logging
import os
import time

logger = logging.getLogger(__name__)

_MAX_ATTEMPTS = 3
_RETRYABLE_STATUS_CODES = (429, 500, 503)
_REQUEST_TIMEOUT_MS = 30_000

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
    empty, the call hangs past a hard timeout, or it fails after retries.

    This runs synchronously inside the invoice upload request, so a
    request with no timeout configured (the SDK default) can hang the
    whole upload indefinitely if the network stalls -- caught by actually
    testing against the live API, not assumed. Every call gets a 30s
    hard timeout via HttpOptions.

    Retries a few times, with a short backoff, on transient errors (429
    rate-limited, 500/503 the model is temporarily overloaded) -- demo-
    scale usage won't hit the free tier's real quota, but the shared
    model itself is sometimes briefly overloaded regardless of quota.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key or not raw_text or not raw_text.strip():
        return []

    from google import genai
    from google.genai import errors as genai_errors
    from google.genai import types as genai_types

    client = genai.Client(
        api_key=api_key,
        http_options=genai_types.HttpOptions(timeout=_REQUEST_TIMEOUT_MS),
    )
    model = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            response = client.models.generate_content(model=model, contents=_PROMPT + raw_text)
            return _parse_response_text(response.text)
        except genai_errors.APIError as exc:
            retryable = getattr(exc, "code", None) in _RETRYABLE_STATUS_CODES
            if retryable and attempt < _MAX_ATTEMPTS:
                logger.warning("Gemini call failed (attempt %d/%d), retrying: %s", attempt, _MAX_ATTEMPTS, exc)
                time.sleep(2**attempt)
                continue
            logger.exception("LLM line-item extraction failed")
            return []
        except Exception:
            logger.exception("LLM line-item extraction failed")
            return []
    return []
