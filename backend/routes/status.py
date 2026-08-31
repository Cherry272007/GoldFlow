"""Connection status endpoint: GET /api/status.

Surfaces market source health (LSE webSocket), AI provider status, and server
health for the ConnectionStatus component.
"""

from flask import Blueprint, current_app, jsonify

bp = Blueprint("status", __name__)


@bp.get("/api/status")
def status():
    store = current_app.config["GOLDFLOW"]
    market = store.market.quote()
    return jsonify(
        {
            "market": {
                "connected": market.get("status") == "LIVE",
                "status": market.get("status", "CONNECTING"),
                "source": store.market.source_info(),
                "last_updated": market.get("timestamp"),
                "price": market.get("price"),
            },
            "ai": store.analysis.status().get("ai"),
            "server": {"connected": True, "time": market.get("timestamp")},
        }
    )