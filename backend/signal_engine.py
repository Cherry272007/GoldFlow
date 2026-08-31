"""Heuristic signal engine.

Produces a BUY / SELL / WAIT from the calculated technical indicators. This
is a deterministic fallback that keeps the dashboard functional even when no
AI provider is configured or an AI call fails. When the AI provider responds,
the AI analysis takes priority over this engine.

Scoring (max 10 points):
  Trend            BULLISH +3 / BEARISH -3
  Price vs EMA20   above +2 / below -2
  EMA20 vs EMA50   above +2 / below -2
  RSI              >55 +1 / <45 -1
  MACD histogram   >0 +1 / <0 -1
"""

from datetime import datetime, timezone


def now_ts():
    return datetime.now(timezone.utc).isoformat()


class SignalEngine:
    def evaluate(self, indicators):
        if not indicators or indicators.get("price") is None:
            return {
                "signal": "WAIT",
                "confidence": 0,
                "trend": "NEUTRAL",
                "risk": "LOW",
                "reason": "No market data available yet.",
                "updated_at": now_ts(),
            }

        buy = sell = 0

        trend = str(indicators.get("trend", "NEUTRAL")).upper()
        if trend == "BULLISH":
            buy += 3
        elif trend == "BEARISH":
            sell += 3

        price = float(indicators["price"])
        ema20 = _f(indicators.get("ema20"))
        ema50 = _f(indicators.get("ema50"))
        if ema20 is not None:
            if price > ema20:
                buy += 2
            elif price < ema20:
                sell += 2
        if ema20 is not None and ema50 is not None:
            if ema20 > ema50:
                buy += 2
            elif ema20 < ema50:
                sell += 2

        rsi = _f(indicators.get("rsi"))
        if rsi is not None and rsi > 55:
            buy += 1
        elif rsi is not None and rsi < 45:
            sell += 1

        hist = _f(indicators.get("macd_histogram"))
        if hist is not None and hist > 0:
            buy += 1
        elif hist is not None and hist < 0:
            sell += 1

        top = max(buy, sell)
        confidence = min(100, int(round(top / 10 * 100)))

        signal, reason = "WAIT", "Signals are mixed or insufficient."
        if buy >= 6 and buy >= sell + 2:
            signal, reason = "BUY", ""
        elif sell >= 6 and sell >= buy + 2:
            signal, reason = "SELL", ""

        risk = self._risk(confidence, indicators)
        return {
            "signal": signal,
            "confidence": confidence,
            "trend": trend,
            "risk": risk,
            "reason": reason,
            "updated_at": now_ts(),
        }

    @staticmethod
    def _risk(confidence, indicators):
        atr = _f(indicators.get("atr"))
        price = _f(indicators.get("price"))
        if not atr or not price:
            return "MEDIUM"
        vol_pct = atr / price * 100
        if confidence < 60:
            return "HIGH"
        if vol_pct >= 0.2:
            return "HIGH"
        if vol_pct >= 0.1:
            return "MEDIUM"
        return "LOW"


def _f(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None