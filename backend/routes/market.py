"""Market data endpoint: GET /api/market."""

from flask import Blueprint, current_app, jsonify

bp = Blueprint("market", __name__)


@bp.route("/api/market")
def market():
    store = current_app.config["GOLDFLOW"]
    data = store.market.quote()
    data["source"] = store.market.source_info()
    return jsonify(data)