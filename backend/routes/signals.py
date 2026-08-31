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


def _column(result):
    if not result:
        return None
    return {
        "signal": result.get("signal"),
        "confidence": int(result.get("confidence") or 0),
        "price": result.get("price"),
        "trend": result.get("trend"),
        "ts": result.get("ts"),
        "provider": result.get("provider"),
        "model": result.get("model"),
    }


@bp.route("/api/compare")
def compare():
    """Side-by-side technical vs AI signals for direct comparison.

    - technical: always the deterministic technical engine (never stale-trading).
    - ai:        the latest AI verdict when one is available (provider != engine);
                 otherwise null so the UI can show that AI is unavailable.
    """
    store = current_app.config["GOLDFLOW"]

    technical = store.analysis.current_heuristic()
    tech_col = _column(technical)

    latest = store.analysis.latest
    ai_col = _column(latest) if latest and latest.get("provider") != "signal-engine" else None
    if ai_col is None and latest and latest.get("ai_error"):
        ai_col = {"signal": "WAIT", "confidence": 0, "provider": "signal-engine",
                  "ai_error": latest.get("ai_error")}

    return jsonify(
        {
            "technical": tech_col,
            "ai": ai_col,
            "ai_configured": store.analysis.ai.configured,
            "market_status": technical.get("market_status"),
        }
    )