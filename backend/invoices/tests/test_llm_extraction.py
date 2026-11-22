from invoices.llm_extraction import _parse_response_text, extract_line_items


def test_parses_a_clean_json_array():
    text = '[{"description": "Widgets", "quantity": "10", "unit_price": "5.00", "amount": "50.00"}]'
    items = _parse_response_text(text)
    assert items == [{"description": "Widgets", "quantity": "10", "unit_price": "5.00", "amount": "50.00"}]


def test_strips_markdown_code_fences():
    text = '```json\n[{"description": "Service fee", "quantity": null, "unit_price": null, "amount": "100"}]\n```'
    items = _parse_response_text(text)
    assert items == [{"description": "Service fee", "quantity": None, "unit_price": None, "amount": "100"}]


def test_empty_array_means_no_line_items():
    assert _parse_response_text("[]") == []


def test_garbage_response_returns_empty_list_not_an_error():
    assert _parse_response_text("sorry, I can't help with that") == []


def test_skips_items_missing_a_description():
    text = '[{"quantity": "1", "amount": "10"}, {"description": "Valid row", "amount": "20"}]'
    items = _parse_response_text(text)
    assert items == [{"description": "Valid row", "quantity": None, "unit_price": None, "amount": "20"}]


def test_non_list_json_returns_empty_list():
    assert _parse_response_text('{"description": "not a list"}') == []


def test_extract_line_items_returns_empty_without_an_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert extract_line_items("some invoice text") == []


def test_extract_line_items_returns_empty_for_blank_text(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key-for-test")
    assert extract_line_items("") == []
    assert extract_line_items("   ") == []
