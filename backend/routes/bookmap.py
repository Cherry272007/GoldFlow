"""Bookmap ingest endpoint: POST /api/bookmap."""

from flask import Blueprint, current_app, jsonify, request

from ..auth import authorize

bp = Blueprint("bookmap", __name__)


def validate(payload, config):
    errors = []
    instrument = str(
        payload.get("instrument") or payload.get("symbol") or config.DEFAULT_SYMBOL
    ).upper()
    if instrument not in config.ALLOWED_BOOKMAP_SYMBOLS:
        errors.append("unsupported instrument %s" % instrument)
    if "timestamp" in payload and not _is_number(payload["timestamp"]):
        errors.append("timestamp must be a number")
    return errors, instrument


@bp.route("/api/bookmap", methods=["POST"])
def submit():
    if not authorize(request):
        return jsonify({"error": "unauthorized"}), 401

    config = current_app.config["GOLDFLOW"]
    payload = request.get_json(silent=True) or {}
    errors, instrument = validate(payload, config)
    if errors:
        return jsonify({"error": "invalid payload", "details": errors}), 400

    flow = str(payload.get("flow", "NEUTRAL")).upper()
    if flow not in ("BUYING", "SELLING", "NEUTRAL"):
        flow = "NEUTRAL"

    state = {
        "instrument": instrument,
        "symbol": instrument,
        "price": _number(payload.get("price")),
        "bid": _number(payload.get("bid")),
        "ask": _number(payload.get("ask")),
        "bid_volume": _number(payload.get("bid_volume")),
        "ask_volume": _number(payload.get("ask_volume")),
        "trade_volume": _number(payload.get("trade_volume")),
        "delta": _number(payload.get("delta", payload.get("delta", 0))) or 0,
        "flow": flow,
        "timestamp": _number(payload.get("timestamp")),
    }

    store = current_app.config["GOLDFLOW_STORE"]
    store.update_bookmap(state)
    return jsonify({"ok": True, "result": store.result})


def _is_number(value):
    return isinstance(value, (int, float))


def _number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None