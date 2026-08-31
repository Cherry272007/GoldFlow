"""Cached technical-indicator engine.

Wraps the pure indicator functions in backend.indicators with a thread-safe
cache so the /api/indicators endpoint never recomputes on every request. A
background thread refreshes the cache whenever new candles arrive.
"""

import threading

from ..indicators import compute_indicators


class TechnicalEngine:
    def __init__(self, market_client):
        self.market = market_client
        self._lock = threading.Lock()
        self._latest = None

    def refresh(self):
        candles = self.market.candles()
        result = compute_indicators(candles)
        with self._lock:
            self._latest = result
        return result

    def latest(self):
        with self._lock:
            return dict(self._latest) if self._latest else None