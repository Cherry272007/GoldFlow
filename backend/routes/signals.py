"""Signal + history endpoints: GET /api/signal and GET /api/history."""

from flask import Blueprint, current_app, jsonify, request

bp = Blueprint("signals", __name__)


@bp.route("/api/signal")
def current():
    """Latest full analysis (AI or degraded heuristic signal)."""
    store = current_app.config["GOLDFLOW"]
    result = store.analysis.current_signal()
    if result:
        return jsonify(result)
    return jsonify(store.analysis.current_heuristic())


@bp.route("/api/history")
def history():
    store = current_app.config["GOLDFLOW"]
    limit = request.args.get("limit", type=int) or 100
    rows = store.history.recent(min(max(limit, 1), 500))
    return jsonify({"history": rows})