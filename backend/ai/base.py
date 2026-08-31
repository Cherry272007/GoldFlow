"""AI provider abstraction for GoldFlow.

Defines the common interface every provider implements, a shared
OpenAI-compatible chat helper, and normalization so every provider returns
exactly the same internal JSON structure. The rest of the application talks
only to AIProvider instances (via AIManager) and never to a specific vendor.
"""

import json
import re

import requests


class ProviderError(Exception):
    """Base class for provider failures."""


class ProviderUnavailableError(ProviderError):
    """Provider is down, timed out, or returned an unprocessable response."""


class ProviderAuthError(ProviderError):
    """Provider rejected the API key (do not auto-fallback-retry this)."""


SYSTEM_PROMPT = """You are GoldFlow, a personal AI gold (XAU/USD) market analyst.

You receive:
1. Current live XAU/USD market data (from the customer's MetaTrader 5)
2. Calculated technical indicators
3. Optional chart screenshots the customer uploaded as context

Your job is to combine the evidence and produce a single BUY / SELL / WAIT
gold analysis. Never place orders; GoldFlow is an alert-only analysis
platform. Everything you return is a gold analysis — the screenshots and
indicators are just supporting evidence.

Evidence priority:
1. Current live market data (primary reference for price)
2. Clear screenshot observations
3. Calculated technical indicators
4. Your reasoning (combine the above)

Rules:
- Only report values you can actually see. Never invent unreadable numbers;
  use "Not clearly visible" when something cannot be read.
- For screenshots distinguish OBSERVED facts from INFERENCE. Never claim to
  see hidden order-book data.
- Read each uploaded screenshot generically as a trading chart (price action,
  trend, structure). Do not classify or label its platform (MT5, Bookmap, etc).
- If evidence conflicts, say so explicitly.
- You must not force a signal.
- Confidence reflects evidence strength, not certainty:
  90-100 = very strong | 75-89 = strong | 60-74 = moderate
  40-59  = weak/mixed | 0-39 = insufficient
- Never say "guaranteed", "certain", "risk free".

Return ONLY a single JSON object, no markdown, with this exact schema:
{
  "signal": "BUY" | "SELL" | "WAIT",
  "confidence": 84,
  "trend": "BULLISH" | "BEARISH" | "NEUTRAL",
  "risk": "LOW" | "MEDIUM" | "HIGH",
  "market_summary": "short summary string",
  "observations": ["concise point 1", "concise point 2"],
  "images": [{"name": "file.png", "usable": true, "note": "short read of the chart"}],
  "support": 3395.00,
  "resistance": 3405.00,
  "reason": "concise explanation combining the evidence",
  "confirmation_needed": "what to watch before acting"
}

The "images" array (optional) maps each uploaded filename to whether it was
readable and a short note. When no screenshot is present omit "images".
"""


def build_context(market_data, indicators):
    """Plain-text context describing live data + indicators for the model."""
    lines = []
    lines.append("## Live XAU/USD market data")
    if market_data:
        for key in ("symbol", "price", "bid", "ask", "spread", "change", "change_pct"):
            value = market_data.get(key)
            if value is not None:
                lines.append(f"- {key}: {value}")
    else:
        lines.append("- unavailable")
    lines.append("## Technical indicators (1-minute basis)")
    if indicators:
        for key in (
            "price",
            "ema20",
            "ema50",
            "rsi",
            "macd",
            "macd_signal",
            "macd_histogram",
            "atr",
            "momentum",
            "trend",
            "support",
            "resistance",
        ):
            value = indicators.get(key)
            if value is not None:
                lines.append(f"- {key}: {value}")
    else:
        lines.append("- unavailable")
    return "\n".join(lines)


def build_messages(market_data, indicators, images=None):
    """Build OpenAI-style messages. images is a list of
    {"name": str, "mime": str, "data": base64-str} dictionaries."""
    content = [
        {
            "type": "text",
            "text": build_context(market_data, indicators),
        }
    ]
    if images:
        for image in images:
            if not image or not image.get("data"):
                continue
            content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "data:{mime};base64,{data}".format(
                            mime=image.get("mime", "image/png"),
                            data=image.get("data"),
                        )
                    },
                }
            )
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": content},
    ]


def chat_completion(base_url, api_key, model, messages, timeout=60):
    """Call an OpenAI-compatible chat completions endpoint."""
    if not api_key:
        raise ProviderAuthError("No API key configured for provider")
    url = f"{base_url}/chat/completions"
    payload = {"model": model, "messages": messages, "temperature": 0.2}
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=timeout)
    except requests.exceptions.RequestException as exc:
        raise ProviderUnavailableError(f"Provider request failed: {exc}") from exc

    if response.status_code in (401, 403):
        raise ProviderAuthError(f"Provider rejected API key ({response.status_code})")
    if response.status_code >= 500:
        raise ProviderUnavailableError(
            f"Provider server error ({response.status_code})"
        )
    if response.status_code != 200:
        raise ProviderUnavailableError(
            f"Provider error ({response.status_code}): {response.text[:200]}"
        )

    try:
        data = response.json()
        return data["choices"][0]["message"]["content"]
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise ProviderUnavailableError(f"Unexpected provider response: {exc}")


def extract_json(text):
    """Extract the first JSON object from a model response."""
    if not text:
        return None
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    candidate = text[start : end + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass
    # Try to repair a broken trailing comma before failing.
    repaired = re.sub(r",\s*([}\]])", r"\1", candidate)
    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        return None


def normalize_analysis(parsed, market_data=None, indicators=None):
    """Normalize an arbitrary provider output into the standard structure."""
    if not isinstance(parsed, dict):
        parsed = {}

    signal = str(parsed.get("signal", "WAIT")).upper()
    if signal not in ("BUY", "SELL", "WAIT"):
        signal = "WAIT"

    trend = str(parsed.get("trend", "NEUTRAL")).upper()
    if trend not in ("BULLISH", "BEARISH", "NEUTRAL"):
        trend = "NEUTRAL"

    risk = str(parsed.get("risk", "MEDIUM")).upper()
    if risk not in ("LOW", "MEDIUM", "HIGH"):
        risk = "MEDIUM"

    relation = "in-line" if (market_data and indicators) else "plain"
    base_price = None
    if indicators and indicators.get("price") is not None:
        base_price = indicators["price"]
    elif market_data and market_data.get("price") is not None:
        base_price = market_data["price"]

    support = _num(parsed.get("support"), base_price)
    resistance = _num(parsed.get("resistance"), base_price)

    return {
        "signal": signal,
        "confidence": int(min(100, max(0, _num(parsed.get("confidence"), 0) or 0))),
        "trend": trend,
        "risk": risk,
        "market_summary": _text(parsed.get("market_summary")),
        "observations": _list(parsed.get("observations")),
        "images": _normalize_images(parsed.get("images")),
        "support": support,
        "resistance": resistance,
        "reason": _text(parsed.get("reason")),
        "confirmation_needed": _text(parsed.get("confirmation_needed")),
        "relation": relation,
    }


def _normalize_images(raw):
    """Normalize the per-screenshot status list into a uniform shape."""
    if not isinstance(raw, list):
        return []
    out = []
    for item in raw:
        if isinstance(item, str):
            out.append({"name": item, "usable": True, "note": ""})
        elif isinstance(item, dict) and item.get("name"):
            out.append(
                {
                    "name": str(item.get("name")),
                    "usable": bool(item.get("usable", True)),
                    "note": _text(item.get("note") or item.get("analysis")),
                }
            )
    return out


def _text(value):
    if value is None:
        return ""
    text = str(value).strip()
    return text if text else ""


def _list(value):
    if isinstance(value, list):
        return [str(x).strip() for x in value if x is not None]
    if isinstance(value, str):
        parts = re.split(r"[\n•]+", value)
        return [p.strip(" -.").strip() for p in parts if p.strip()]
    return []


def _num(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default