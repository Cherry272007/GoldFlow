"""Web Push subscription endpoints.

  GET  /api/push/public-key   the VAPID public key (for the browser to subscribe)
  POST /api/push/subscribe    store the browser PushSubscription
  POST /api/push/unsubscribe  remove a stored subscription
  GET  /api/push/status       configured + subscriber count (health)

The frontend registers a service worker, calls pushManager.subscribe() with the
public key, then POSTs the resulting subscription here. The backend later
delivers a push when a fresh BUY/SELL signal fires.
"""

from flask import Blueprint, current_app, jsonify, request

from .. import config
from ..services.push_service import PushService

bp = Blueprint("push", __name__)


@bp.get("/api/push/public-key")
def public_key():
    service = current_app.config["GOLDFLOW"].push
    if not service.configured:
        return jsonify({"enabled": False, "public_key": None}), 501
    return jsonify({"enabled": True, "public_key": service.public_key()})


@bp.get("/api/push/status")
def status():
    service = current_app.config["GOLDFLOW"].push
    return jsonify(service.status())


@bp.post("/api/push/subscribe")
def subscribe():
    service = current_app.config["GOLDFLOW"].push
    body = request.get_json(silent=True) or {}
    endpoint = (body.get("endpoint") or "").strip()
    p256dh = (body.get("p256dh") or "").strip()
    auth = (body.get("auth") or "").strip()

    if not (endpoint and p256dh and auth):
        return jsonify({"error": "Missing endpoint / p256dh / auth."}), 400
    if not endpoint.startswith("https://") and not endpoint.startswith("http://"):
        return jsonify({"error": "Invalid endpoint."}), 400

    service.store.add(
        endpoint, p256dh, auth, user_agent=request.headers.get("User-Agent", "")[:200]
    )
    return jsonify({"ok": True, "subscribers": service.store.count()})


@bp.post("/api/push/unsubscribe")
def unsubscribe():
    service = current_app.config["GOLDFLOW"].push
    body = request.get_json(silent=True) or {}
    endpoint = (body.get("endpoint") or "").strip()
    if endpoint:
        service.store.remove(endpoint)
    return jsonify({"ok": True, "subscribers": service.store.count()})
