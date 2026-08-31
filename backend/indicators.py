"""Technical indicator engine.

Computes classic indicators from the 1-minute candle series:

  EMA 20 / EMA 50
  RSI 14
  MACD (12/26/9)
  ATR 14
  Momentum
  Support / Resistance (recent swing levels)
  Trend

All calculations are pure functions over a list of candles so they are easy
to test and independent of any charting library. GoldFlow never renders a
chart; indicators are used only for the signal engine and AI context.
"""


def ema(values, period):
    """Exponential moving average over a numeric series."""
    if not values:
        return []
    k = 2 / (period + 1)
    out = [values[0]]
    for value in values[1:]:
        out.append(value * k + out[-1] * (1 - k))
    return out


def ema_last(values, period):
    series = ema(list(values), period)
    return round(series[-1], 4) if series else None


def rsi(values, period=14):
    """Relative Strength Index (Wilder smoothing)."""
    if len(values) < period + 1:
        return None
    gains, losses = [], []
    for i in range(1, len(values)):
        change = values[i] - values[i - 1]
        gains.append(max(change, 0.0))
        losses.append(max(-change, 0.0))
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0
    rs = avg_gain / avg_loss
    return round(100 - 100 / (1 + rs), 2)


def macd(closes, fast=12, slow=26, signal=9):
    """Return (macd_line, signal_line, histogram)."""
    if len(closes) < slow + signal:
        return None, None, None
    fast_series = ema(closes, fast)
    slow_series = ema(closes, slow)
    macd_line = [f - s for f, s in zip(fast_series, slow_series)]
    signal_series = ema(macd_line, signal)
    macd_val = macd_line[-1] - signal_series[-1]
    return (
        round(macd_line[-1], 4),
        round(signal_series[-1], 4),
        round(macd_val, 4),
    )


def atr(candles, period=14):
    """Average True Range over candles with high/low/close."""
    if len(candles) < period + 1:
        return None
    trs = []
    prev_close = candles[0]["close"]
    for candle in candles[1:]:
        high, low, close = candle["high"], candle["low"], candle["close"]
        tr = max(
            high - low,
            abs(high - prev_close),
            abs(low - prev_close),
        )
        trs.append(tr)
        prev_close = close
    return round(sum(trs[-period:]) / period, 4)


def momentum(closes, lookback=10):
    if len(closes) < lookback + 1 or not closes[-1]:
        return None
    prev = closes[-1 - lookback]
    if prev == 0:
        return 0.0
    return round((closes[-1] - prev) / prev * 100, 3)


def momentum_label(value):
    if value is None:
        return "NEUTRAL"
    if value >= 0.15:
        return "STRONG"
    if value <= -0.15:
        return "WEAK"
    return "NEUTRAL"


def support_resistance(candles, window=20):
    """Approximate support/resistance from recent swing lows/highs."""
    if len(candles) < 5:
        return None, None
    recent = candles[-window:]
    lows = [c["low"] for c in recent if c.get("low") is not None]
    highs = [c["high"] for c in recent if c.get("high") is not None]
    if not lows or not highs:
        return None, None
    support = _mode_round(lows)
    resistance = _mode_round(highs)
    if support is None:
        support = round(min(lows), 2)
    if resistance is None:
        resistance = round(max(highs), 2)
    return support, resistance


def _mode_round(values, bins=20):
    """Cluster values into bins and return the bucket with most members."""
    if not values:
        return None
    lo, hi = min(values), max(values)
    if hi - lo <= 1e-9:
        return round(lo, 2)
    step = (hi - lo) / bins
    buckets = {}
    for value in values:
        idx = int((value - lo) / step)
        idx = min(idx, bins - 1)
        buckets.setdefault(idx, []).append(value)
    best_idx = max(buckets, key=lambda k: len(buckets[k]))
    cluster = buckets[best_idx]
    return round(sum(cluster) / len(cluster), 2)


def trend(closes, ema20, ema50, price):
    """Classify the trend from moving-average alignment."""
    if price is None or ema20 is None or ema50 is None:
        return "NEUTRAL"
    if len(closes) >= 2:
        rising = closes[-1] > closes[-2]
        falling = closes[-1] < closes[-2]
    else:
        rising = falling = False
    if ema20 > ema50 and price > ema20 and rising:
        return "BULLISH"
    if ema20 < ema50 and price < ema20 and falling:
        return "BEARISH"
    if ema20 > ema50 and price > ema20:
        return "BULLISH"
    if ema20 < ema50 and price < ema20:
        return "BEARISH"
    return "NEUTRAL"


def compute_indicators(candles):
    """Compute the full indicator set from 1-minute candles."""
    closes = [float(c["close"]) for c in candles if c.get("close") is not None]
    price = closes[-1] if closes else None

    ema20 = ema_last(closes, 20)
    ema50 = ema_last(closes, 50)
    rsi14 = rsi(closes, 14)
    macd_line, macd_signal, macd_hist = macd(closes)
    atr14 = atr(candles, 14)
    mom = momentum(closes, 10)
    support, resistance = support_resistance(candles, 20)
    trend_label = trend(closes, ema20, ema50, price)

    return {
        "price": round(price, 4) if price is not None else None,
        "ema20": ema20,
        "ema50": ema50,
        "rsi": rsi14,
        "macd": macd_line,
        "macd_signal": macd_signal,
        "macd_histogram": macd_hist,
        "atr": atr14,
        "momentum": momentum_label(mom),
        "momentum_value": mom,
        "trend": trend_label,
        "support": support,
        "resistance": resistance,
        "candle_count": len(candles),
        "timestamp": candles[-1]["time"] if candles else None,
    }