"""MT5 ingest endpoint: POST /api/mt5."""

from flask import Blueprint, current_app, jsonify, request

from ..auth import authorize

bp = Blueprint("mt5", __name__)


def validate(payload, config):
    errors = []
    symbol = str(payload.get("symbol", config.DEFAULT_SYMBOL)).upper()
    if symbol and symbol not in config.ALLOWED_MT5_SYMBOLS:
        errors.append("unsupported symbol %s" % symbol)
    if "bid" in payload and not _is_number(payload["bid"]):
        errors.append("bid must be a number")
    if "ask" in payload and not _is_number(payload["ask"]):
        errors.append("ask must be a number")
    if "timestamp" in payload and not _is_number(payload["timestamp"]):
        errors.append("timestamp must be a number")
    return errors, symbol


@bp.route("/api/mt5", methods=["POST"])
def submit():
    if not authorize(request):
        return jsonify({"error": "unauthorized"}), 401

    config = current_app.config["GOLDFLOW"]
    payload = request.get_json(silent=True) or {}
    errors, symbol = validate(payload, config)
    if errors:
        return jsonify({"error": "invalid payload", "details": errors}), 400

    state = {
        "symbol": symbol,
        "bid": _number(payload.get("bid")),
        "ask": _number(payload.get("ask")),
        "spread": _number(payload.get("spread", _spread(payload))),
        "h1_trend": str(payload.get("h1_trend", "NEUTRAL")).upper(),
        "m15_structure": str(payload.get("m15_structure", "NEUTRAL")).upper(),
        "timestamp": _number(payload.get("timestamp")),
    }

    store = current_app.config["GOLDFLOW_STORE"]
    store.update_mt5(state)
    return jsonify({"ok": True, "result": store.result})


def _spread(payload):
    try:
        bid = float(payload["bid"])
        ask = float(payload["ask"])
        return ask - bid
    except (KeyError, TypeError, ValueError):
        return None


def _is_number(value):
    return isinstance(value, (int, float))


def _number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None