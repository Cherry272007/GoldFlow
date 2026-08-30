"""Status endpoint: GET /api/status."""

from flask import Blueprint, current_app, jsonify

from ..services.signal_engine import seconds_since

bp = Blueprint("status", __name__)


@bp.route("/api/status")
def status():
    store = current_app.config["GOLDFLOW_STORE"]
    with store._lock:
        mt5 = dict(store.mt5)
        bookmap = dict(store.bookmap)

    def source(state):
        return {
            "connected": state.get("connected", False),
            "last_seen": state.get("last_seen"),
            "age_seconds": round(seconds_since(state.get("last_seen")) or 0, 1),
        }

    return jsonify(
        {
            "mt5": source(mt5),
            "bookmap": source(bookmap),
            "server": {"connected": True, "time": store.result.get("updated_at")},
        }
    )