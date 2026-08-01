from flask import Blueprint, jsonify

from ..utils import meta

blueprint = Blueprint("health", __name__)


@blueprint.get("/api/v1/health")
def health():
    return jsonify({
        "status": "ok",
        "configured": True,
        "meta": meta(),
    })
