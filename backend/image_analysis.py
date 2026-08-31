"""Screenshot handling.

Screenshots are private user data:
  * kept in memory only during the request,
  * never written to disk or logged,
  * deleted after analysis (there is no persistence step).

The frontend uploads images as base64 data URLs. A quality check and a
defensive downscale happen here so oversized screenshots do not bloat AI
tokens, then the resized image is sent to the provider as a data URL.
"""

import base64
import binascii
import io

from . import config

EXTENSIONS = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}

MAX_DIMENSION = 1600  # keep vision tokens reasonable


class ImageError(Exception):
    pass


def decode_image(payload):
    """Decode and validate a screenshot payload.

    ``payload`` may be a base64 data URL ("data:image/png;base64,...") or a
    raw base64 string. Returns (bytes, mime). Raises ImageError on failure.
    """
    if not payload or not isinstance(payload, str):
        raise ImageError("No image data provided.")

    mime = None
    data = payload
    if payload.startswith("data:"):
        try:
            header, _, data = payload.partition(",")
            mime = header[5:].split(";")[0].strip()
        except (ValueError, IndexError):
            raise ImageError("Malformed data URL.")
    if not data:
        raise ImageError("Empty image data.")

    try:
        raw = base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError):
        # tolerate missing padding / non-strict base64
        try:
            raw = base64.b64decode(data + "=" * ((4 - len(data) % 4) % 4))
        except (binascii.Error, ValueError) as exc:
            raise ImageError("Image data is not valid base64.") from exc

    if len(raw) == 0:
        raise ImageError("Empty image file.")
    if len(raw) > config.MAX_IMAGE_MB * 1024 * 1024:
        raise ImageError(
            f"Image is too large (max {config.MAX_IMAGE_MB:.0f} MB)."
        )

    if mime and mime not in config.ALLOWED_IMAGE_TYPES:
        raise ImageError("Unsupported image type.")

    # Verify the file really is an image and discover its actual type.
    from PIL import Image, UnidentifiedImageError

    try:
        with Image.open(io.BytesIO(raw)) as img:
            detected = img.format and img.format.lower()
        if not mime:
            mime = _mime_for_format(detected)
    except UnidentifiedImageError as exc:
        raise ImageError("Image file is unreadable or corrupted.") from exc

    if mime not in EXTENSIONS:
        raise ImageError("Unsupported image type. Use PNG, JPG, or WEBP.")

    return raw, mime


def prepare_for_vision(raw, mime):
    """Downscale + re-encode the image and return a new (mime, base64)."""
    from PIL import Image, UnidentifiedImageError

    try:
        with Image.open(io.BytesIO(raw)) as img:
            img = img.convert("RGB")
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
            buf = io.BytesIO()
            fmt = "JPEG" if mime == "image/jpeg" else "PNG"
            img.save(buf, format=fmt)
            resized_raw = buf.getvalue()
            resized_mime = "image/jpeg" if fmt == "JPEG" else "image/png"
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ImageError("Screenshot could not be processed.") from exc

    encoded = base64.b64encode(resized_raw).decode("ascii")
    return resized_mime, encoded


def process_screenshot(payload):
    """Full pipeline: validate, decode, downscale -> hash-safe image record."""
    raw, mime = decode_image(payload)
    resized_mime, encoded = prepare_for_vision(raw, mime)
    return {"mime": resized_mime, "data": encoded}


def _mime_for_format(fmt):
    fmt = (fmt or "").lower()
    if fmt in ("jpeg", "jpg"):
        return "image/jpeg"
    if fmt == "png":
        return "image/png"
    if fmt == "webp":
        return "image/webp"
    return None