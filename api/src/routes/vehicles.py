from flask import Blueprint, current_app, jsonify

from ..catalog import OSWEGO_ROUTE_IDS, ROUTE_METADATA
from ..services.centro_client import CentroAPIError, get_client
from ..utils import iso_bustime, meta, validate_route
from ..middleware.request_id import json_error

blueprint = Blueprint("vehicles", __name__)


def _resolve_client():
    client = current_app.config.get("CENTRO_CLIENT")
    if client is not None:
        return client
    return get_client()


def _extract_vehicles(body, route_id):
    items = body.get("vehicle") or body.get("vehicles") or []
    result = []
    for item in items:
        if item.get("lat") is None or item.get("lon") is None:
            continue
        speed = item.get("spd")
        result.append({
            "id": str(item.get("vid")),
            "routeId": str(item.get("rt") or route_id),
            "destination": item.get("des"),
            "direction": item.get("rtdir"),
            "lat": float(item["lat"]),
            "lng": float(item["lon"]),
            "heading": int(item.get("hdg") or 0),
            "speed": float(speed) if speed is not None else None,
            "patternId": str(item.get("pid")) if item.get("pid") else None,
            "delayed": bool(item.get("dly")),
            "updatedAt": iso_bustime(item.get("tmstmp")),
        })
    return result


@blueprint.get("/api/v1/routes/<route_id>/vehicles")
def vehicles(route_id):
    route_id = validate_route(route_id)
    if not route_id:
        return json_error("UNKNOWN_ROUTE", "This Oswego route is not supported.", 404)

    client = _resolve_client()
    body = client.vehicles(route_id)
    result = _extract_vehicles(body, route_id)

    return jsonify({
        "routeId": route_id,
        "vehicles": result,
        "message": None if result else "No live buses on this route.",
        "meta": meta(live=True),
    })


@blueprint.get("/api/v1/vehicles")
def all_vehicles():
    result = []
    last_error = None
    for rid in OSWEGO_ROUTE_IDS:
        try:
            client = _resolve_client()
            body = client.vehicles(rid)
        except CentroAPIError as error:
            last_error = error
            continue
        items = body.get("vehicle") or body.get("vehicles") or []
        for item in items:
            if item.get("lat") is None or item.get("lon") is None:
                continue
            speed = item.get("spd")
            result.append({
                "id": str(item.get("vid")),
                "routeId": rid,
                "shortName": ROUTE_METADATA[rid]["shortName"],
                "color": ROUTE_METADATA[rid]["color"],
                "destination": item.get("des"),
                "direction": item.get("rtdir"),
                "lat": float(item["lat"]),
                "lng": float(item["lon"]),
                "heading": int(item.get("hdg") or 0),
                "speed": float(speed) if speed is not None else None,
                "patternId": str(item.get("pid")) if item.get("pid") else None,
                "delayed": bool(item.get("dly")),
                "updatedAt": iso_bustime(item.get("tmstmp")),
            })

    return jsonify({
        "vehicles": result,
        "total": len(result),
        "message": None if result
                  else str(last_error) if last_error
                  else "No active buses across Oswego routes.",
        "meta": meta(live=bool(result)),
    })
