"""In-memory state store for MT5 and Bookmap plus the current signal.

All reads/writes go through a single lock so the polling dashboard and the
ingest endpoints never see torn state.
"""

from threading import Lock
from datetime import datetime, timezone


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def initial_mt5(symbol="XAUUSD"):
    return {
        "symbol": symbol,
        "bid": None,
        "ask": None,
        "spread": None,
        "h1_trend": "NEUTRAL",
        "m15_structure": "NEUTRAL",
        "timestamp": None,
        "last_seen": None,
        "connected": False,
    }


def initial_bookmap(symbol="XAUUSD"):
    return {
        "instrument": symbol,
        "symbol": symbol,
        "price": None,
        "bid": None,
        "ask": None,
        "bid_volume": None,
        "ask_volume": None,
        "trade_volume": None,
        "delta": 0,
        "flow": "NEUTRAL",
        "timestamp": None,
        "last_seen": None,
        "connected": False,
    }


class GoldFlowStore:
    def __init__(self, signal_engine, history, default_symbol):
        self._lock = Lock()
        self._engine = signal_engine
        self._history = history
        self.mt5 = initial_mt5(default_symbol)
        self.bookmap = initial_bookmap(default_symbol)
        self.result = {
            "signal": "WAIT",
            "strength": 0,
            "confidence": 0,
            "buy_score": 0,
            "sell_score": 0,
            "reason": "Waiting for MT5 and Bookmap data",
            "updated_at": None,
        }
        self._last_recorded_signal = None

    def update_mt5(self, data):
        with self._lock:
            self.mt5.update(data)
            self.mt5["last_seen"] = now_iso()
            self.mt5["connected"] = True
            self._recompute()

    def update_bookmap(self, data):
        with self._lock:
            self.bookmap.update(data)
            self.bookmap["last_seen"] = now_iso()
            self.bookmap["connected"] = True
            self._recompute()

    def tick(self):
        """Called periodically by the connection monitor."""
        with self._lock:
            self._recompute()

    def snapshot(self):
        with self._lock:
            return {
                "mt5": dict(self.mt5),
                "bookmap": dict(self.bookmap),
                "result": dict(self.result),
            }

    def _recompute(self):
        self.mt5["connected"] = self._engine.is_fresh(self.mt5.get("last_seen"))
        self.bookmap["connected"] = self._engine.is_fresh(self.bookmap.get("last_seen"))
        self.result = self._engine.evaluate(self.mt5, self.bookmap)
        self._record_transition()

    def _record_transition(self):
        signal = self.result.get("signal")
        if signal == self._last_recorded_signal:
            return
        self._last_recorded_signal = signal
        price = self.mt5.get("bid") or self.bookmap.get("price")
        self._history.add(
            ts=self.result.get("updated_at"),
            symbol=self.mt5.get("symbol") or self.bookmap.get("symbol"),
            signal=signal,
            strength=self.result.get("strength", 0),
            price=price,
            h1_trend=self.mt5.get("h1_trend"),
            m15_structure=self.mt5.get("m15_structure"),
            bookmap_flow=self.bookmap.get("flow"),
            delta=self.bookmap.get("delta"),
        )