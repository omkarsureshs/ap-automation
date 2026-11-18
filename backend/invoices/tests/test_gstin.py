from invoices.gstin import is_valid_gstin


def test_valid_gstin_passes():
    # Structural prefix "27AAACC1206D1Z" with its correct modulo-36 check
    # digit computed by hand (verified: the commonly-quoted example
    # "27AAACC1206D1Z0" does NOT actually satisfy the checksum).
    assert is_valid_gstin("27AAACC1206D1ZG") is True


def test_wrong_length_fails():
    assert is_valid_gstin("27AAACC1206D1Z") is False


def test_right_length_wrong_checksum_fails():
    assert is_valid_gstin("27AAACC1206D1Z9") is False
