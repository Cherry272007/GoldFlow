"""GoldFlow signal engine.

Combines MT5 market data and Bookmap order-flow data into
a BUY / SELL / WAIT alert with a confidence percentage.

Rules (alert-only, by design):
* Conflicting or missing information produces WAIT.
* Stale data never produces a buy or sell signal.

Scoring (out of a maximum of 7 points per side):
  H1 trend        BULLISH +2 / BEARISH -2
  M15 structure   BULLISH +1 / BEARISH -1
  Bookmap flow    BUYING  +2 / SELLING -2
  Delta           >0 +1 / <0 -1
  Bid/Ask volume  bid > ask +1 / ask > bid -1
"""

from datetime import datetime, timezone

NEUTRAL = "NEUTRAL"


def now_ts():
    return datetime.now(timezone.utc).isoformat()


def seconds_since(iso):
    if not iso:
        return None
    try:
        then = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - then).total_seconds()
    except (TypeError, ValueError):
        return None


class SignalEngine:
    def __init__(self, stale_after=30):
        self.stale_after = stale_after

    def is_fresh(self, last_seen):
        age = seconds_since(last_seen)
        return age is not None and age <= self.stale_after

    def evaluate(self, mt5, bookmap):
        """Return the current result dict for the two source states."""
        reasons = []
        if not self.is_fresh(mt5.get("last_seen")):
            reasons.append("MT5 data unavailable")
        if not self.is_fresh(bookmap.get("last_seen")):
            reasons.append("Bookmap data unavailable")

        if reasons:
            return {
                "signal": "WAIT",
                "strength": 0,
                "confidence": 0,
                "buy_score": 0,
                "sell_score": 0,
                "reason": "Stale data. " + " and ".join(reasons),
                "updated_at": now_ts(),
            }

        buy = sell = 0
        h1 = _norm(mt5.get("h1_trend"))
        m15 = _norm(mt5.get("m15_structure"))
        flow = _norm(bookmap.get("flow"))

        if h1 == "BULLISH":
            buy += 2
        elif h1 == "BEARISH":
            sell += 2

        if m15 == "BULLISH":
            buy += 1
        elif m15 == "BEARISH":
            sell += 1

        if flow == "BUYING":
            buy += 2
        elif flow == "SELLING":
            sell += 2

        delta = _num(bookmap.get("delta"))
        if delta and delta > 0:
            buy += 1
        elif delta and delta < 0:
            sell += 1

        bid_vol = _num(bookmap.get("bid_volume"))
        ask_vol = _num(bookmap.get("ask_volume"))
        if bid_vol is not None and ask_vol is not None and bid_vol != ask_vol:
            if bid_vol > ask_vol:
                buy += 1
            else:
                sell += 1

        top = max(buy, sell)
        confidence = min(100, int(round(top / 7 * 100)))
        signal, reason = "WAIT", "Signals conflicting or too weak"
        if buy >= 5 and buy >= sell + 2:
            signal, reason = "BUY", ""
        elif sell >= 5 and sell >= buy + 2:
            signal, reason = "SELL", ""

        return {
            "signal": signal,
            "strength": confidence,
            "confidence": confidence,
            "buy_score": buy,
            "sell_score": sell,
            "reason": reason,
            "updated_at": now_ts(),
        }


def _norm(value):
    value = str(value).strip().upper()
    return value if value in ("BULLISH", "BEARISH", "BUYING", "SELLING", "BUY", "SELL") else NEUTRAL


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None