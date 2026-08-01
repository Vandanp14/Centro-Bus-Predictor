from __future__ import annotations

import uuid

from flask import g, jsonify, request


def assign_request_id():
    g.request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]


def json_error(code: str, message: str, status: int):
    return (
        jsonify({
            "error": {
                "code": code,
                "message": message,
                "requestId": getattr(g, "request_id", None),
            }
        }),
        status,
    )
