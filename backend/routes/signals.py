"""Signal endpoints: GET /api/signal and GET /api/history."""

from flask import Blueprint, current_app, jsonify, request

bp = Blueprint("signals", __name__)


@bp.route("/api/signal")
def current():
    store = current_app.config["GOLDFLOW_STORE"]
    result = dict(store.result)
    with store._lock:
        result["symbol"] = store.mt5.get("symbol") or store.bookmap.get("symbol")
        result["price"] = store.mt5.get("bid") or store.bookmap.get("price")
        result["h1_trend"] = store.mt5.get("h1_trend")
        result["m15_structure"] = store.mt5.get("m15_structure")
        result["bookmap_flow"] = store.bookmap.get("flow")
        result["delta"] = store.bookmap.get("delta")
    return jsonify(result)


@bp.route("/api/history")
def history():
    store = current_app.config["GOLDFLOW_STORE"]
    limit = request.args.get("limit", type=int) or 100
    rows = store._history.recent(min(limit, 500))
    for row in rows:
        if "id" in row:
            row.pop("id")
    return jsonify({"history": rows})