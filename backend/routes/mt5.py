"""MT5 (GoldFlowEA) ingest endpoint.

POST /api/mt5  - receive a live tick payload from the customer's MetaTrader 5
                 GoldFlowEA and apply it as the primary market quote.

The EA only sends data; it never trades. Payload fields (all optional except
price or bid/ask): symbol, price, bid, ask, spread, timestamp, volume,
h1_trend, m15_structure.

Auth follows the same rule as the other write endpoints: when GOLDFLOW_API_KEY
is configured the request must carry it as ``Authorization: Bearer`` or
``X-GoldFlow-Key``.
"""

from flask import Blueprint, current_app, jsonify, request

from ..auth import authorize

bp = Blueprint("mt5", __name__)


@bp.post("/api/mt5")
def ingest():
    if not authorize(request):
        return jsonify({"error": "unauthorized"}), 401

    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return jsonify({"error": "expected a JSON object"}), 400

    symbol = body.get("symbol") or body.get("instrument")
    price = body.get("price")
    bid = body.get("bid")
    ask = body.get("ask")

    if price is None and bid is None and ask is None:
        return jsonify(
            {"error": "Provide price, or bid and ask."}
        ), 400

    store = current_app.config["GOLDFLOW"]
    payload = dict(body)
    if symbol:
        payload["symbol"] = symbol

    ok = store.market.ingest_mt5(payload)
    if not ok:
        return jsonify({"error": "Could not apply the MT5 payload"}), 400

    from ..websocket import broadcast_market

    market = store.market.quote()
    broadcast_market(market, store.technical.latest(), store.analysis.current_signal())
    return jsonify({"ok": True, "quote": market}), 200
