"""Deterministic fallback analysis used when no AI provider produces a result.

Keeps the dashboard functional and the /api/signal endpoint meaningful even
when every AI provider is down or unconfigured.
"""

from .. import config
from .base import normalize_analysis
from ..signal_engine import SignalEngine


def heuristic_fallback(market_data, indicators):
    engine = SignalEngine()
    result = engine.evaluate(indicators)

    price = indicators.get("price") if indicators else None
    if price is None and market_data:
        price = market_data.get("price")

    market_word = "No live price available yet" if price is None else (
        f"Live {config.DISPLAY_SYMBOL} price is {price}. "
        f"Trend: {result['trend']}. Confidence in the technical picture: "
        f"{result['confidence']}%."
    )

    return normalize_analysis(
        {
            "signal": result["signal"],
            "confidence": result["confidence"],
            "trend": result["trend"],
            "risk": result["risk"],
            "market_summary": market_word,
            "reason": result["reason"] or "Deterministic technical signal.",
            "confirmation_needed": (
                "Re-run Analyze once market data or screenshots are available, "
                "or review price action around support/resistance."
            ),
            "support": (indicators or {}).get("support"),
            "resistance": (indicators or {}).get("resistance"),
        },
        market_data,
        indicators,
    )