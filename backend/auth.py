"""Authentication helpers.

Requests authenticate with a private GoldFlow API key using:

    Authorization: Bearer GF_xxxxxxxxxxxxxxxxx

For backward compatibility the legacy X-GoldFlow-Key header is also accepted.
"""

import hmac

from .config import API_KEY


def expires_in(a, b):
    return hmac.compare_digest(str(a), str(b))


def authorize(request):
    """Return True when the request carries a valid GoldFlow key."""
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return expires_in(header.split(" ", 1)[1].strip(), API_KEY)
    legacy = request.headers.get("X-GoldFlow-Key", "")
    if legacy:
        return expires_in(legacy, API_KEY)
    return False