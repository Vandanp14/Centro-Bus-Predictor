from flask import Blueprint, current_app, jsonify, request

from ..services.centro_client import get_client
from ..services.pattern_store import refresh
from ..utils import meta, validate_route
from ..middleware.request_id import json_error

blueprint = Blueprint("patterns", __name__)


def _resolve_client():
    client = current_app.config.get("CENTRO_CLIENT")
    if client is not None:
        return client
    return get_client()


@blueprint.get("/api/v1/routes/<route_id>/patterns")
def patterns(route_id):
    route_id = validate_route(route_id)
    if not route_id:
        return json_error("UNKNOWN_ROUTE", "This Oswego route is not supported.", 404)

    requested_direction = (request.args.get("direction") or "").strip()
    client = _resolve_client()
    items = refresh(client, route_id)
    result = []

    for pattern in items:
        direction = str(pattern.get("rtdir") or "")
        if requested_direction and direction != requested_direction:
            continue
        points = []
        for point in pattern.get("pt") or []:
            if point.get("lat") is None or point.get("lon") is None:
                continue
            points.append({
                "sequence": int(point.get("seq") or len(points) + 1),
                "lat": float(point["lat"]),
                "lng": float(point["lon"]),
                "type": point.get("typ"),
                "stopId": str(point.get("stpid")) if point.get("stpid") else None,
                "stopName": point.get("stpnm"),
            })
        result.append({
            "id": str(pattern.get("pid")),
            "direction": direction,
            "distance": pattern.get("ln"),
            "points": points,
        })

    return jsonify({
        "routeId": route_id,
        "direction": requested_direction or None,
        "patterns": result,
        "message": None if result else "No route shape is available.",
        "meta": meta(live=True),
    })
