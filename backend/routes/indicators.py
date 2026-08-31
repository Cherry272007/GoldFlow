"""Indicators endpoint: GET /api/indicators."""

from flask import Blueprint, current_app, jsonify

bp = Blueprint("indicators", __name__)


@bp.route("/api/indicators")
def indicators():
    store = current_app.config["GOLDFLOW"]
    return jsonify(store.technical.latest() or {})