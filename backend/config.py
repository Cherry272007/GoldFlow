"""GoldFlow backend configuration.

Every value can be overridden with an environment variable so the same code
runs locally and on Render without modifications.

Never expose these keys to the frontend. The .env file must stay out of Git.
"""

import os
from pathlib import Path


def _load_dotenv():
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.is_file():
        load_dotenv(env_path)


_load_dotenv()

# On some setups (e.g. python.org macOS builds) the default TLS store is
# empty; point the system store at certifi so London Strategic Edge HTTPS
# works. An explicitly set SSL_CERT_FILE always wins.
try:
    import certifi

    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
except ImportError:
    pass


def _as_int(name, default):
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _as_float(name, default):
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _csv(raw, upper=True):
    tokens = [token.strip() for token in raw.split(",") if token.strip()]
    return [t.upper() if upper else t for t in tokens]


# ---------------------------------------------------------------------------
# Private GoldFlow API key (optional)
# ---------------------------------------------------------------------------
# When set, POST /api/analyze and POST /api/analyze-image require it via
#   Authorization: Bearer <key>   or   X-GoldFlow-Key: <key>
# The dashboard browser client sends it from VITE_GOLDFLOW_API_KEY at build
# time. Leave empty to run with no auth on the analyze endpoints.
GOLDFLOW_API_KEY = os.environ.get("GOLDFLOW_API_KEY", "").strip()

# ---------------------------------------------------------------------------
# AI provider — OpenRouter (the only provider for now)
# ---------------------------------------------------------------------------
# Active provider name. Keep at "openrouter" until a second provider exists.
AI_PROVIDER = os.environ.get("AI_PROVIDER", "openrouter").lower().strip()
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "").strip()
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "minimax/minimax-m3:free").strip()
OPENROUTER_BASE_URL = os.environ.get(
    "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
).rstrip("/")

# Seconds to wait for an OpenRouter response before timing out.
AI_TIMEOUT_SECONDS = _as_float("AI_TIMEOUT_SECONDS", 60)

# AI is only run on user action (Analyze / upload) and at most every
# AI_INTERVAL_MINUTES when the automatic refresh is enabled.
# 0 disables automatic AI re-runs to minimize cost.
AI_INTERVAL_MINUTES = _as_int("AI_INTERVAL_MINUTES", 0)

# ---------------------------------------------------------------------------
# Market data — London Strategic Edge (lse-data)
# ---------------------------------------------------------------------------
LSE_API_KEY = os.environ.get("LSE_API_KEY", "").strip()

# market provider: auto | mt5 | lse | simulated
#   auto       -> mt5-primary (ticks from GoldFlowEA via /api/mt5), with LSE
#                 candles + fallback price; simulated if nothing is configured
#   mt5        -> force MT5-primary live feed (reads /api/mt5), LSE for candles
#   lse        -> force London Strategic Edge as the live feed
#   simulated  -> local random feed for development/demo
MARKET_PROVIDER = os.environ.get("MARKET_PROVIDER", "auto").lower().strip()

# MT5 (GoldFlowEA) primary feed. When set, ticks arrive via POST /api/mt5.
MT5_SYMBOL = os.environ.get("MT5_SYMBOL", "").strip() or "XAUUSD"

# Instrument streamed from LSE.
MARKET_SYMBOL = os.environ.get("MARKET_SYMBOL", "XAU/USD").strip()
# Display symbol sent to the dashboard.
DISPLAY_SYMBOL = os.environ.get("GOLDFLOW_DISPLAY_SYMBOL", "XAU/USD").strip()

# Market status thresholds:
#   LIVE  - tick received within the last STALE_AFTER_SECONDS
#   STALE - no tick for STALE_AFTER_SECONDS+, last known price still shown
#   DOWN  - upstream WebSocket disconnected / reconnecting
STALE_AFTER_SECONDS = _as_float("GOLDFLOW_STALE_AFTER", 30)

# How often (seconds) the 1-minute candles used for indicators are refreshed.
CANDLE_POLL_SECONDS = _as_float("CANDLE_POLL_SECONDS", 60)
# How many 1-minute candles to keep for indicator calculations.
CANDLES_LIMIT = _as_int("CANDLES_LIMIT", 120)

# Simulated price baseline used only when no real provider is configured.
SIMULATED_BASE_PRICE = _as_float("SIMULATED_BASE_PRICE", 3435.0)

# ---------------------------------------------------------------------------
# Screenshot uploads
# ---------------------------------------------------------------------------
MAX_IMAGES = _as_int("GOLDFLOW_MAX_IMAGES", 4)
MAX_IMAGE_MB = _as_float("GOLDFLOW_MAX_IMAGE_MB", 5)
ALLOWED_IMAGE_TYPES = _csv(
    os.environ.get("GOLDFLOW_ALLOWED_IMAGE_TYPES", "image/png,image/jpeg,image/webp"),
    upper=False,
)

# ---------------------------------------------------------------------------
# Storage
# ---------------------------------------------------------------------------
DB_PATH = os.environ.get("GOLDFLOW_DB", "goldflow.db")
HISTORY_LIMIT = _as_int("GOLDFLOW_HISTORY_LIMIT", 500)