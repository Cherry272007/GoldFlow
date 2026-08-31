"""Analysis endpoints.

  GET  /api/analysis       latest combined analysis
  POST /api/analyze-image  classify + analyze a single screenshot
  POST /api/analyze        combined market + indicators + screenshots analysis

Images are accepted as a JSON list of {"name", "mime", "data"} objects where
data is a base64 data URL. They are held in memory only and are never stored.
"""

from flask import Blueprint, current_app, jsonify, request

from .. import config, image_analysis
from ..auth import authorize
from ..websocket import broadcast_analysis

bp = Blueprint("analysis", __name__)


@bp.get("/api/config")
def config_status():
    """Public capability/config info (never includes any secret)."""
    push = current_app.config["GOLDFLOW"].push
    return jsonify(
        {
            "auth_required": bool(config.GOLDFLOW_API_KEY),
            "max_images": config.MAX_IMAGES,
            "max_image_mb": config.MAX_IMAGE_MB,
            "push_enabled": push.configured,
            "vapid_public_key": push.public_key() if push.configured else None,
        }
    )


def _require_auth():
    if not authorize(request):
        return jsonify({"error": "unauthorized"}), 401
    return None


@bp.get("/api/analysis")
def latest():
    store = current_app.config["GOLDFLOW"]
    result = store.analysis.current_signal()
    if result is None:
        return jsonify({"available": False, "signal": "WAIT"})
    result["available"] = True
    market, indicators = store.analysis.snapshot()
    result["_market"] = market
    result["_indicators"] = indicators
    return jsonify(result)


@bp.post("/api/analyze-image")
def analyze_image():
    denied = _require_auth()
    if denied:
        return denied

    store = current_app.config["GOLDFLOW"]
    body = request.get_json(silent=True) or {}
    payload = body.get("image") or body.get("data")

    if isinstance(payload, str):
        image = {"name": body.get("name", "screenshot.png"), "data": payload}
    elif isinstance(payload, dict):
        image = {
            "name": payload.get("name", "screenshot.png"),
            "data": payload.get("data"),
            "mime": payload.get("mime", "image/png"),
        }
    else:
        return jsonify(
            {"error": "Provide an image as a base64 data URL."}
        ), 400

    try:
        image.update(image_analysis.process_screenshot(image["data"]))
    except image_analysis.ImageError as exc:
        return jsonify({"error": str(exc)}), 400

    try:
        result = store.analysis.analyze_image(image)
    except Exception:
        return jsonify(
            {"error": "AI analysis temporarily unavailable. Please try again."}
        ), 503
    return jsonify(result)


@bp.post("/api/analyze")
def analyze():
    denied = _require_auth()
    if denied:
        return denied

    store = current_app.config["GOLDFLOW"]
    body = request.get_json(silent=True) or {}
    raw_images = body.get("images") or []
    force_ai = bool(body.get("force_ai", True))

    if not isinstance(raw_images, list):
        raw_images = [raw_images]
    if len(raw_images) > config.MAX_IMAGES:
        return jsonify(
            {"error": f"Too many screenshots (max {config.MAX_IMAGES})."}
        ), 400

    images = []
    for i, item in enumerate(raw_images):
        if isinstance(item, str):
            item = {"name": f"screenshot-{i + 1}", "data": item}
        if not isinstance(item, dict):
            continue
        try:
            images.append(image_analysis.process_screenshot(item.get("data")))
        except image_analysis.ImageError as exc:
            return jsonify(
                {"error": f"{item.get('name', 'screenshot')}: {exc}"}
            ), 400

    try:
        result = store.analysis.run_analysis(images=images or None, force_ai=force_ai)
    except Exception:
        return jsonify(
            {"error": "AI analysis temporarily unavailable. Please try again."}
        ), 503

    broadcast_analysis(result)
    if result.get("ai_error"):
        result["degraded"] = True
    result["images_count"] = len(images)
    return jsonify(result), 200