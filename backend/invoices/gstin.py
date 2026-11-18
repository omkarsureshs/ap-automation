import re

_CODESET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
_STRUCTURE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$")


def _check_digit(first_14: str) -> str:
    total = 0
    factor = 1
    for char in first_14:
        product = _CODESET.index(char) * factor
        total += product // 36 + product % 36
        factor = 2 if factor == 1 else 1
    return _CODESET[(36 - (total % 36)) % 36]


def is_valid_gstin(value: str) -> bool:
    if len(value) != 15 or not _STRUCTURE.match(value):
        return False
    return _check_digit(value[:14]) == value[14]
