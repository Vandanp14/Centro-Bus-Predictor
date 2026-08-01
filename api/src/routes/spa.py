from pathlib import Path

from flask import Blueprint, jsonify, send_from_directory

from ..config import BUILD_DIR
from ..middleware.request_id import json_error

blueprint = Blueprint("spa", __name__)


def _serve_spa(path=""):
    requested_path = (BUILD_DIR / path).resolve()
    try:
        requested_path.relative_to(BUILD_DIR.resolve())
    except ValueError:
        return json_error("NOT_FOUND", "File not found.", 404)

    if path and requested_path.is_file():
        return send_from_directory(BUILD_DIR, path)
    if (BUILD_DIR / "index.html").is_file():
        return send_from_directory(BUILD_DIR, "index.html")
    return jsonify({
        "name": "Centro Oswego API",
        "message": "Frontend build not found. Run npm run build.",
        "api": "/api/v1/health",
    })


@blueprint.get("/", defaults={"path": ""})
@blueprint.get("/<path:path>")
def serve_spa(path):
    if path.startswith("api/"):
        return json_error("NOT_FOUND", "API endpoint not found.", 404)
    return _serve_spa(path)
