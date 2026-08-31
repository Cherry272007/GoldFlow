"""Analysis service.

Orchestrates the full analysis flow:

  market snapshot + indicators (+ screenshots)
      -> AIManager (OpenRouter)
      -> normalized analysis dict
      -> stored in history + broadcast over WebSocket

If the AI call fails (after one retry for transient errors) the failure is
surfaced as a friendly error. A deterministic technical signal
(backend.signal_engine) is returned as a degraded result so the dashboard
always has a signal - this is not a provider fallback, it is the built-in
technical engine.
"""

import threading
import time
from datetime import datetime, timezone

from .. import config
from ..ai import AIManager, ProviderUnavailableError
from ..ai.signal_fallback import heuristic_fallback
from ..signal_engine import SignalEngine


class AnalysisService:
    def __init__(self, market_client, technical_engine, history, push_service=None):
        self.market = market_client
        self.technical = technical_engine
        self.history = history
        self.push = push_service
        self.ai = AIManager()
        self._lock = threading.Lock()
        self.latest = None
        self.last_error = None
        self.last_ai_at = None
        self.last_ai_attempt = None

    # ------------------------------------------------------------------
    # Snapshots
    # ------------------------------------------------------------------
    def current_indicators(self):
        return self.technical.latest()

    def snapshot(self):
        return self.market.quote(), self.current_indicators()

    # ------------------------------------------------------------------
    # Analysis
    # ------------------------------------------------------------------
    def run_analysis(self, images=None, force_ai=True):
        market, indicators = self.snapshot()
        result = self._compute(market, indicators, images, force_ai=force_ai)
        self._store(result)
        self._notify(result)
        return dict(result)

    def _notify(self, result):
        """Send a push notification for a fresh BUY/SELL (silent otherwise)."""
        if self.push is not None:
            try:
                self.push.notify_signal(result)
            except Exception:  # never let notifications break an analysis
                pass

    def analyze_image(self, image):
        market, indicators = self.snapshot()
        result = self._compute(market, indicators, [image], force_ai=True)
        classification = self._image_classification(result, image)
        return {
            "classification": classification,
            "analysis": result,
            "market": market,
            "indicators": indicators,
        }

    def _compute(self, market, indicators, images, force_ai=True):
        error = None
        if self._should_use_ai(force_ai):
            for attempt in (1, 2):  # one retry for transient errors only
                try:
                    self.last_ai_attempt = datetime.now(timezone.utc).isoformat()
                    result = self.ai.analyze(market, indicators, images)
                    result["ts"] = datetime.now(timezone.utc).isoformat()
                    result["market_status"] = market.get("status")
                    self.last_error = None
                    with self._lock:
                        self.latest = dict(result)
                    return result
                except ProviderUnavailableError as exc:
                    error = str(exc)
                    self.last_error = error
                except Exception as exc:  # never crash an analysis
                    error = str(exc)
                    self.last_error = str(exc)
                if attempt == 1:
                    time.sleep(1.5)

        result = heuristic_fallback(market, indicators)
        result["ts"] = datetime.now(timezone.utc).isoformat()
        result["market_status"] = market.get("status")
        result["provider"] = "signal-engine"
        result["model"] = "technical"
        if images:
            result["images_uploaded"] = len(images)
        if error:
            result["ai_error"] = error
        with self._lock:
            self.latest = dict(result)
        return result

    def _should_use_ai(self, force_ai):
        if not self.ai.configured:
            return False
        if force_ai:
            return True
        if not config.AI_INTERVAL_MINUTES:
            return False
        if self.last_ai_at is None:
            return True
        age = (datetime.now(timezone.utc) - self.last_ai_at).total_seconds()
        return age >= config.AI_INTERVAL_MINUTES * 60

    def _store(self, result):
        market, indicators = self.snapshot()
        price = indicators.get("price")
        if price is None:
            price = market.get("price")

        media = None
        image_items = [
            str(i.get("name"))
            for i in (result.get("images") or [])
            if isinstance(i, dict) and i.get("name")
        ]
        if image_items:
            media = ",".join(image_items)

        record = {
            "ts": result.get("ts"),
            "signal": result.get("signal"),
            "confidence": result.get("confidence"),
            "trend": result.get("trend"),
            "risk": result.get("risk"),
            "price": price,
            "reason": result.get("reason"),
            "market_summary": result.get("market_summary"),
            "support": result.get("support"),
            "resistance": result.get("resistance"),
            "provider": result.get("provider"),
            "model": result.get("model"),
            "media": media or None,
            "payload": result,
        }
        self.history.add(record)

    def _image_classification(self, result, image):
        for img in result.get("images") or []:
            if isinstance(img, dict) and img.get("name") == image.get("name"):
                return {
                    "name": img.get("name"),
                    "usable": img.get("usable", False),
                    "note": img.get("note", ""),
                    "analysis": img.get("note", ""),
                }
        return {
            "name": image.get("name"),
            "usable": False,
            "note": "Not analysed — screenshot could not be read.",
            "analysis": "",
        }

    # ------------------------------------------------------------------
    # Public reads
    # ------------------------------------------------------------------
    def current_signal(self):
        """Latest analysis, honouring the stale-data guard.

        If the market feed is not currently LIVE, the stored signal is never
        served as a fresh BUY/SELL - it is coerced to WAIT so the dashboard
        never shows a potentially stale trade recommendation.
        """
        with self._lock:
            result = dict(self.latest) if self.latest else None
        market = self.market.quote()
        status = market.get("status")
        if result is None:
            return None
        result["market_status"] = status
        if status != "LIVE":
            result["signal"] = "WAIT"
            result["confidence"] = int(result.get("confidence") or 0)
            result["reason"] = self._stale_reason(status, result)
            result["stale_override"] = True
        return result

    @staticmethod
    def _stale_reason(status, result):
        reason = result.get("reason") or ""
        note = {
            "STALE": "Market data is stale - signal forced to WAIT.",
            "DOWN": "Market data is unavailable - signal forced to WAIT.",
            "CONNECTING": "Awaiting market data - signal forced to WAIT.",
        }.get(status, "No fresh market data - signal forced to WAIT.")
        return f"{note} {reason}".strip()

    def current_heuristic(self):
        market, indicators = self.snapshot()
        result = SignalEngine().evaluate(indicators)
        result["price"] = indicators.get("price") or market.get("price")
        result["provider"] = "signal-engine"
        result["model"] = "technical"
        status = market.get("status")
        result["market_status"] = status
        if status != "LIVE":
            result["signal"] = "WAIT"
            result["stale_override"] = True
        return result

    def status(self):
        return {
            "ai": self.ai.status(),
            "last_error": self.last_error,
            "history_count": self.history.count(),
            "ai_enabled": self.ai.configured,
        }