"""Authentication helpers for the optional GoldFlow API key.

When GOLDFLOW_API_KEY is configured, write endpoints require it either via
``Authorization: Bearer <key>`` or the legacy ``X-GoldFlow-Key`` header.
Constant-time comparison is used to avoid timing attacks.
"""

import hmac

from .config import GOLDFLOW_API_KEY


def _compare(a, b):
    try:
        return hmac.compare_digest(str(a).encode(), str(b).encode())
    except (TypeError, ValueError):
        return False


def authorize(request):
    """Return True when the request is authorized.

    If no API key is configured, any request is allowed (open mode, typical
    for a public single-user dashboard). If a key is configured and the
    request carries a wrong key, it is rejected.
    """
    if not GOLDFLOW_API_KEY:
        return True

    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        if _compare(header.split(" ", 1)[1].strip(), GOLDFLOW_API_KEY):
            return True

    legacy = request.headers.get("X-GoldFlow-Key", "")
    if legacy and _compare(legacy, GOLDFLOW_API_KEY):
        return True

    return False