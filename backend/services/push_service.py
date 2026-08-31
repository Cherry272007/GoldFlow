"""Web Push delivery.

Wraps pywebpush (HTTP Web Push via VAPID) so GoldFlow can send native phone
notifications when a fresh BUY/SELL signal fires. Only sends when VAPID keys
are configured; otherwise it is a silent no-op so the app works without push.

Notifications are best-effort: a failed send (e.g. the subscription expired)
is logged and the bad subscription is pruned, but never breaks an analysis.
"""

import logging
import threading

from .. import config

log = logging.getLogger("goldflow.push")

try:
    from pywebpush import WebPushException, webpush
    _WEBPUSH_AVAILABLE = True
except Exception:  # pragma: no cover - optional dependency
    _WEBPUSH_AVAILABLE = False

_IGNORED_SEND_ERRORS = (410, 404)  # subscription gone / not found -> prune


class PushService:
    def __init__(self, store):
        self.store = store
        self._lock = threading.Lock()
        self._last_signal = None

    @property
    def configured(self):
        return bool(
            _WEBPUSH_AVAILABLE
            and config.VAPID_PUBLIC_KEY
            and config.VAPID_PRIVATE_KEY
        )

    def public_key(self):
        """The VAPID public key the browser needs to subscribe with."""
        return config.VAPID_PUBLIC_KEY

    # ------------------------------------------------------------------
    # Sending
    # ------------------------------------------------------------------
    def _payload(self, title, body, **extra):
        import json

        data = {"title": title, "body": body}
        if extra:
            data.update(extra)
        return json.dumps(data)

    def _send_one(self, sub, payload):
        try:
            webpush(
                subscription_info=sub,
                data=payload,
                vapid_private_key=config.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": config.VAPID_SUBJECT or "mailto:admin@localhost"},
                ttl=7200,
            )
            return None
        except WebPushException as exc:
            status = None
            try:
                status = exc.response.status_code
            except Exception:
                pass
            if status in _IGNORED_SEND_ERRORS:
                log.info("pruning expired push subscription: %s", sub.get("endpoint"))
                return sub.get("endpoint")
            log.warning("push send failed (%s): %s", status, exc)
            return None
        except Exception as exc:  # pragma: no cover - defensive
            log.warning("push send error: %s", exc)
            return None

    def broadcast(self, title, body, **extra):
        """Send to every stored subscription, pruning any that are gone."""
        if not self.configured:
            return 0
        subs = self.store.all()
        if not subs:
            return 0
        payload = self._payload(title, body, **extra)
        dead = []
        for sub in subs:
            if self._send_one(sub, payload):
                dead.append(sub.get("endpoint"))
        if dead:
            self.store.remove_many(dead)
        return len(subs) - len(dead)

    # ------------------------------------------------------------------
    # Signal notification (only on fresh BUY/SELL)
    # ------------------------------------------------------------------
    def notify_signal(self, result):
        """Emit a push only when a fresh BUY/SELL signal appears.

        Should be called after an analysis is computed and stored. A WAIT signal
        (or a stale-forced WAIT) is intentionally silent.
        """
        if result is None:
            return
        signal = (result.get("signal") or "WAIT").upper()
        if signal not in ("BUY", "SELL"):
            return
        if result.get("stale_override"):
            return

        confidence = int(result.get("confidence") or 0)
        trend = (result.get("trend") or "").upper()
        body = f"{trend + ' · ' if trend else ''}Confidence {confidence}%"
        reason = (result.get("reason") or result.get("market_summary") or "").strip()
        if reason:
            body = f"{body}\n{reason[:160]}"

        price = result.get("price")
        arrow = "▲" if signal == "BUY" else "▼"

        with self._lock:
            current = (result.get("ts") or "", result.get("signal") or "")
            if current[0] and current == self._last_signal:
                return  # duplicate signal, skip
            self._last_signal = current

        self.broadcast(
            f"{arrow} GOLDFLOW says {signal}",
            body,
            signal=signal,
            confidence=confidence,
            price=price,
        )

    def status(self):
        return {
            "configured": self.configured,
            "subscribers": self.store.count(),
        }
