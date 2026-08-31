"""Market data client for XAU/USD.

Primary source: the customer's MetaTrader 5 (GoldFlowEA) which POSTs a small
tick payload to POST /api/mt5 (presented as HTTP mode). London Strategic Edge
(lse-data) is kept as an optional secondary for 1-minute candles used by the
technical indicator engine, plus a quoted fallback price when the MT5 feed is
stale. A fully simulated feed keeps local development usable when no keys are
configured.

The backend holds a single market state in a background thread and
re-broadcasts ticks to browsers over Flask-SocketIO. The frontend never talks
to MT5 or LSE directly and never sees any API key.

1-minute candles are fetched from the LSE REST vault and cached for the
technical indicator engine (or generated synthetically when LSE is absent).

Market status is derived from the freshness of the latest tick:
  LIVE  - tick within STALE_AFTER_SECONDS
  STALE - no tick for STALE_AFTER_SECONDS+, last known price shown
  DOWN  - upstream connection failed / reconnecting (streaming sources)
  CONNECTING - no tick received yet
"""

import random
import threading
import time
from datetime import datetime, timedelta, timezone

from . import config


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def _fmt(value, digits=None):
    try:
        value = float(value)
    except (TypeError, ValueError):
        return None
    return round(value, digits) if digits is not None else value


class MarketDataClient:
    """Provides cached quotes and 1-minute candles for the configured symbol."""

    def __init__(self):
        provider = config.MARKET_PROVIDER
        if provider == "simulated" or (provider == "auto" and not config.MT5_SYMBOL):
            self.mode = "simulated"
        elif provider in ("mt5", "auto", "lse"):
            # MT5 is the preferred live feed; LSE streams candles in the
            # background. Fall back to simulated candles if LSE is absent.
            self.mode = provider
        else:
            self.mode = "simulated"

        self.symbol = config.MARKET_SYMBOL or config.MT5_SYMBOL or "XAU/USD"
        self.stale_after = config.STALE_AFTER_SECONDS

        self._lock = threading.Lock()
        self._quote = self._empty_quote()
        self._candles = []
        self._running = False
        self._stop = threading.Event()
        self._last_tick_at = None   # monotonic time of last live tick
        self._stream_up = False     # False while the upstream (LSE) is down

        # Per-source quotes so the dashboard can show MT5 and LSE live values
        # independently. MT5 is the primary feed; LSE is secondary + candles.
        self._mt5_quote = self._empty_source_quote("mt5")
        self._lse_quote = self._empty_source_quote("lse")
        self._mt5_last_at = None    # monotonic time of last MT5 tick
        self._lse_last_at = None    # monotonic time of last LSE tick
        self._lse_stream_up = False

        # For simulated fallback nearly everywhere (candles, dev feed).
        self._sim_price = config.SIMULATED_BASE_PRICE
        self._seed_candles()

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def start(self):
        if self._running:
            return
        self._running = True
        # A simulator supplies ticks only in pure simulated mode; otherwise
        # ticks arrive from the HTTP ingest route (MT5) or LSE stream.
        if self.mode == "simulated":
            threading.Thread(
                target=self._simulator_loop, daemon=True, name="market-data"
            ).start()
        else:
            threading.Thread(
                target=self._lse_loop, daemon=True, name="market-data-lse"
            ).start()
        threading.Thread(
            target=self._candle_loop, daemon=True, name="market-candles"
        ).start()

    def stop(self):
        self._stop.set()

    # ------------------------------------------------------------------
    # Public reads
    # ------------------------------------------------------------------
    def quote(self):
        with self._lock:
            data = dict(self._quote)
            data["sources"] = {
                "mt5": self._source_quote_locked("mt5"),
                "lse": self._source_quote_locked("lse"),
                "active": self._active_source_locked(),
            }
            return data

    def candles(self):
        with self._lock:
            return [dict(c) for c in self._candles]

    def source_info(self):
        label = {
            "lse": "London Strategic Edge",
            "mt5": "MetaTrader 5 (GoldFlowEA)",
            "simulated": "Simulated feed",
        }.get(self.mode, self.mode)
        data = self.quote()
        return {
            "mode": self.mode,
            "label": label,
            "live": data.get("status") == "LIVE",
            "symbol": self.symbol,
            "status": data.get("status"),
            "sources": data.get("sources"),
        }

    def _empty_source_quote(self, source):
        return {
            "key": source,
            "name": "MetaTrader 5 (GoldFlowEA)"
            if source == "mt5"
            else "London Strategic Edge",
            "short": "MT5" if source == "mt5" else "LSE",
            "role": "Primary live feed" if source == "mt5" else "Secondary + candles",
            "price": None,
            "bid": None,
            "ask": None,
            "spread": None,
            "status": "CONNECTING",
            "timestamp": None,
        }

    def _source_quote_locked(self, source):
        base = dict(self._mt5_quote if source == "mt5" else self._lse_quote)
        last_at = self._mt5_last_at if source == "mt5" else self._lse_last_at
        base["status"] = self._source_status_locked(source, last_at)
        return base

    def _source_status_locked(self, source, last_at):
        if self.mode == "simulated":
            return "LIVE" if source == "mt5" else "DOWN"
        if last_at is None:
            return "CONNECTING"
        age = time.monotonic() - last_at
        if age <= self.stale_after:
            return "LIVE"
        return "STALE"

    def _active_source_locked(self):
        # Which source is currently feeding the blended quote.
        if self.mode == "simulated":
            return "simulated"
        if self._mt5_last_at is not None:
            return "mt5"
        return "lse"

    # ------------------------------------------------------------------
    # MT5 HTTP ingest (called from POST /api/mt5)
    # ------------------------------------------------------------------
    def ingest_mt5(self, payload):
        """Apply a GoldFlowEA tick payload as the primary live quote."""
        symbol = (payload.get("symbol") or self.symbol).strip().replace("/", "")
        price = _fmt(payload.get("price"))
        if price is None:
            bid = _fmt(payload.get("bid"))
            ask = _fmt(payload.get("ask"))
            if bid is not None and ask is not None:
                price = round((bid + ask) / 2, 5)
        if price is None:
            return False

        bid = _fmt(payload.get("bid"), 5)
        ask = _fmt(payload.get("ask"), 5)
        if bid is None:
            bid = round(price - 0.15, 2)
        if ask is None:
            ask = round(price + 0.15, 2)
        spread = _fmt(payload.get("spread"))
        if spread is None and bid is not None and ask is not None:
            spread = round(ask - bid, 5)

        # Change vs previous live price.
        previous = self.quote().get("price")
        change = None
        change_pct = None
        if previous is not None and price is not None:
            change = round(price - previous, 4)
            change_pct = round(change / previous * 100, 4) if previous else None

        ts = payload.get("timestamp")
        if ts is None:
            ts = now_iso()

        record = {
            "symbol": symbol,
            "price": round(price, 5),
            "bid": bid,
            "ask": ask,
            "spread": spread,
            "change": change,
            "change_pct": change_pct,
            "volume": _fmt(payload.get("volume"), 0),
            "h1_trend": (payload.get("h1_trend") or "NEUTRAL").upper(),
            "m15_structure": (payload.get("m15_structure") or "NEUTRAL").upper(),
            "status": "LIVE",
            "timestamp": ts,
        }

        with self._lock:
            self._last_tick_at = time.monotonic()
            self._quote = record
            self._stream_up = True

            # Track the MT5 source quote independently.
            self._mt5_last_at = time.monotonic()
            self._mt5_quote.update(
                {
                    "price": round(price, 5),
                    "bid": bid,
                    "ask": ask,
                    "spread": spread,
                    "status": "LIVE",
                    "timestamp": ts,
                }
            )
        return True

    # ------------------------------------------------------------------
    # London Strategic Edge stream (secondary / fallback quote)
    # ------------------------------------------------------------------
    def _lse_loop(self):
        if not config.LSE_API_KEY:
            # No LSE key: nothing to stream (MT5 provides ticks instead).
            self._set_stream_up(False)
            return
        backoff = 2.0
        while not self._stop.is_set():
            try:
                from lse import LSE

                client = LSE(api_key=config.LSE_API_KEY)
                self._set_stream_up(True)
                for tick in client.stream([self.symbol]):
                    self._handle_lse_tick(tick)
                    backoff = 2.0
                self._set_stream_up(False)
            except Exception:
                self._set_stream_up(False)
            self._stop.wait(backoff)
            backoff = min(backoff * 2, 60.0)

    def _handle_lse_tick(self, tick):
        price = _fmt(getattr(tick, "price", None))
        if price is None:
            return
        bid = _fmt(getattr(tick, "bid", None), 4)
        ask = _fmt(getattr(tick, "ask", None), 4)
        volume = _fmt(getattr(tick, "volume", None))
        raw_time = getattr(tick, "timestamp", None)
        ts = now_iso()
        if raw_time is not None:
            try:
                ts = str(raw_time).replace(" ", "T").replace("Z", "+00:00")
                ts = datetime.fromisoformat(ts).astimezone(timezone.utc).isoformat()
            except (TypeError, ValueError):
                ts = now_iso()

        previous = self.quote().get("price")
        change = None
        change_pct = None
        if previous is not None and price is not None:
            change = round(price - previous, 4)
            change_pct = round(change / previous * 100, 3) if previous else None

        # Always record LSE's own latest quote so it can be shown independently.
        with self._lock:
            self._lse_last_at = time.monotonic()
            self._lse_quote.update(
                {
                    "price": price,
                    "bid": bid or round(price - 0.15, 2),
                    "ask": ask or round(price + 0.15, 2),
                    "spread": _fmt(ask - bid, 4)
                    if bid is not None and ask is not None
                    else None,
                    "status": "LIVE",
                    "timestamp": ts,
                }
            )

            # LSE is a fallback only when MT5 has not supplied a fresher tick.
            if self._mt5_is_fresh_locked():
                return
            self._last_tick_at = time.monotonic()
            self._quote = {
                "symbol": self.symbol,
                "price": price,
                "bid": bid or round(price - 0.15, 2),
                "ask": ask or round(price + 0.15, 2),
                "spread": _fmt(ask - bid, 4)
                if bid is not None and ask is not None
                else None,
                "change": change,
                "change_pct": change_pct,
                "volume": volume,
                "status": "LIVE",
                "timestamp": ts,
            }

    def _mt5_is_fresh(self):
        if self.mode not in ("mt5", "auto", "lse"):
            return False
        with self._lock:
            if self._mt5_last_at is None:
                return False
            return time.monotonic() - self._mt5_last_at <= self.stale_after / 2

    def _mt5_is_fresh_locked(self):
        if self.mode not in ("mt5", "auto", "lse"):
            return False
        if self._mt5_last_at is None:
            return False
        return time.monotonic() - self._mt5_last_at <= self.stale_after / 2

    # ------------------------------------------------------------------
    # 1-minute candles (LSE REST, or simulated)
    # ------------------------------------------------------------------
    def _candle_loop(self):
        while not self._stop.is_set():
            try:
                self._refresh_candles()
            except Exception:
                pass
            self._stop.wait(config.CANDLE_POLL_SECONDS)

    def _refresh_candles(self):
        if self.mode == "simulated":
            with self._lock:
                self._candles = self._candles[-config.CANDLES_LIMIT :]
            return
        if not config.LSE_API_KEY:
            with self._lock:
                self._candles = self._candles[-config.CANDLES_LIMIT :]
            return
        from lse import LSE

        client = LSE(api_key=config.LSE_API_KEY)
        rows = client.candles(
            self.symbol, timeframe="1m", limit=config.CANDLES_LIMIT, order="desc"
        )
        candles = self._normalize_candles(rows)
        candles.reverse()  # vault returns newest-first; store oldest->newest
        if not candles:
            return
        with self._lock:
            self._candles = candles[-config.CANDLES_LIMIT :]

    @staticmethod
    def _normalize_candles(rows):
        candles = []
        for row in rows:
            ts = (
                row.get("timestamp")
                or row.get("time")
                or row.get("ts")
                or row.get("datetime")
            )
            open_ = _pick(row, ("open", "o", "open_price"), 4)
            high = _pick(row, ("high", "h", "high_price"), 4)
            low = _pick(row, ("low", "l", "low_price"), 4)
            close = _pick(row, ("close", "c", "close_price"), 4)
            if ts is None or close is None:
                continue
            candles.append(
                {
                    "time": str(ts),
                    "open": open_ if open_ is not None else close,
                    "high": high if high is not None else close,
                    "low": low if low is not None else close,
                    "close": close,
                    "volume": _fmt(row.get("volume", 0), 0),
                }
            )
        return candles

    # ------------------------------------------------------------------
    # Status bookkeeping
    # ------------------------------------------------------------------
    def _set_stream_up(self, up):
        with self._lock:
            self._stream_up = up
            if up:
                self._quote["status"] = "LIVE"
            else:
                self._quote["status"] = "DOWN"

    def _apply_staleness(self):
        """Re-derive LIVE/STALE/DOWN/CONNECTING from tick age."""
        with self._lock:
            if self._last_tick_at is None:
                self._quote["status"] = "CONNECTING" if self.mode != "simulated" else "LIVE"
                return
            age = time.monotonic() - self._last_tick_at
            if age <= self.stale_after:
                self._quote["status"] = "LIVE"
            else:
                self._quote["status"] = "STALE"

    def tick(self):
        """Called periodically (background loop) to update LIVE/STALE/DOWN."""
        self._apply_staleness()

    # ------------------------------------------------------------------
    # Simulated feed
    # ------------------------------------------------------------------
    def _simulator_loop(self):
        last_minute = -1
        while not self._stop.is_set():
            previous = self._sim_price
            drift = random.uniform(-1.8, 1.8)
            self._sim_price = max(1.0, previous + drift)
            price = round(self._sim_price, 4)
            change = round(price - previous, 4)
            change_pct = round(change / previous * 100, 3) if previous else 0
            bid = round(price - 0.15, 2)
            ask = round(price + 0.15, 2)
            with self._lock:
                self._last_tick_at = time.monotonic()
                self._quote = {
                    "symbol": self.symbol,
                    "price": price,
                    "bid": bid,
                    "ask": ask,
                    "spread": 0.30,
                    "change": change,
                    "change_pct": change_pct,
                    "volume": random.randint(1, 40),
                    "h1_trend": "NEUTRAL",
                    "m15_structure": "NEUTRAL",
                    "status": "LIVE",
                    "timestamp": now_iso(),
                }
            now_minute = time.gmtime().tm_min
            if now_minute != last_minute:
                last_minute = now_minute
                with self._lock:
                    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
                    self._candles.append(
                        {
                            "time": now.isoformat(),
                            "open": round(previous, 4),
                            "high": max(previous, price),
                            "low": min(previous, price),
                            "close": price,
                            "volume": random.randint(40, 400),
                        }
                    )
                    self._candles = self._candles[-config.CANDLES_LIMIT :]
            self._stop.wait(2.0)

    def _seed_candles(self):
        random.seed(20260831)
        now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        price = self._sim_price
        candles = []
        for i in range(config.CANDLES_LIMIT):
            ts = now - timedelta(minutes=config.CANDLES_LIMIT - i)
            open_ = price
            drift = random.uniform(-2.2, 2.2)
            close = max(1.0, open_ + drift)
            high = max(open_, close) + random.uniform(0, 1.4)
            low = min(open_, close) - random.uniform(0, 1.4)
            candles.append(
                {
                    "time": ts.isoformat(),
                    "open": round(open_, 4),
                    "high": round(high, 4),
                    "low": round(low, 4),
                    "close": round(close, 4),
                    "volume": round(random.uniform(40, 400)),
                }
            )
            price = close
        self._candles = candles
        self._sim_price = price

    def _empty_quote(self):
        return {
            "symbol": self.symbol,
            "price": None,
            "bid": None,
            "ask": None,
            "spread": None,
            "change": None,
            "change_pct": None,
            "volume": None,
            "status": "CONNECTING",
            "timestamp": None,
        }


def _pick(row, keys, digits=None):
    for key in keys:
        value = row.get(key)
        if value is not None:
            return _fmt(value, digits)
    return None
