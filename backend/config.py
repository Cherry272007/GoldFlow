"""GoldFlow backend configuration.

All values can be overridden with environment variables so the same code
runs locally and on Render without changes.
"""

import os


def _as_int(name, default):
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _csv(raw):
    return [token.strip().upper() for token in raw.split(",") if token.strip()]


# Private GoldFlow API key. Must begin with "GF_". Never expose in client JS.
API_KEY = os.environ.get("GOLDFLOW_API_KEY", "GF_dev_key_change_me")

# A source is considered stale (disconnected) after this many seconds.
STALE_AFTER_SECONDS = _as_int("GOLDFLOW_STALE_AFTER", 30)

# Primary symbol expected from MT5.
DEFAULT_SYMBOL = os.environ.get("GOLDFLOW_SYMBOL", "XAUUSD")

# Symbols the backend accepts from MT5.
ALLOWED_MT5_SYMBOLS = _csv(os.environ.get("GOLDFLOW_ALLOWED_MT5_SYMBOLS", "XAUUSD"))

# Symbols the backend accepts from Bookmap. XAUUSD, GC futures, CFDs ...
ALLOWED_BOOKMAP_SYMBOLS = _csv(os.environ.get("GOLDFLOW_ALLOWED_BOOKMAP_SYMBOLS", "XAUUSD,GC,GOLD"))

# SQLite database path for signal history.
DB_PATH = os.environ.get("GOLDFLOW_DB", "goldflow.db")

# Maximum number of history rows to keep.
HISTORY_LIMIT = _as_int("GOLDFLOW_HISTORY_LIMIT", 500)