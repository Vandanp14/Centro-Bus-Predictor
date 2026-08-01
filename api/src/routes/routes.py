from flask import Blueprint, jsonify, request

from ..catalog import OSWEGO_ROUTE_IDS, ROUTE_METADATA, catalog_routes
from flask import current_app

from ..services.centro_client import CentroAPIError, get_client
from ..utils import first_upstream_message, meta, validate_route
from ..middleware.request_id import json_error


def _resolve_client():
    client = current_app.config.get("CENTRO_CLIENT")
    if client is not None:
        return client
    return get_client()


blueprint = Blueprint("routes", __name__)


@blueprint.get("/api/v1/routes")
def routes():
    catalog = {route["id"]: route for route in catalog_routes()}
    live = True
    message = None

    try:
        client = _resolve_client()
        body = client.routes()
        upstream = body.get("routes") or body.get("route") or []
        for route in upstream:
            route_id = str(route.get("rt", "")).upper()
            if route_id not in catalog:
                continue
            catalog[route_id]["name"] = route.get("rtnm") or catalog[route_id]["fallbackName"]
            catalog[route_id]["upstreamColor"] = route.get("rtclr")
    except CentroAPIError as error:
        live = False
        message = str(error)

    ordered = [catalog[rid] for rid in OSWEGO_ROUTE_IDS]
    return jsonify({
        "routes": ordered,
        "meta": meta(live=live, message=message),
    })


@blueprint.get("/api/v1/routes/<route_id>/directions")
def directions(route_id):
    route_id = validate_route(route_id)
    if not route_id:
        return json_error("UNKNOWN_ROUTE", "This Oswego route is not supported.", 404)

    client = _resolve_client()
    body = client.directions(route_id)
    items = body.get("directions") or body.get("dir") or []
    result = [
        {
            "id": str(item.get("id") or item.get("name") or ""),
            "name": str(item.get("name") or item.get("id") or ""),
        }
        for item in items
        if item.get("id") or item.get("name")
    ]
    return jsonify({
        "routeId": route_id,
        "directions": result,
        "message": None if result else first_upstream_message(body, "No directions are available."),
        "meta": meta(live=True),
    })


@blueprint.get("/api/v1/routes/<route_id>/stops")
def stops(route_id):
    route_id = validate_route(route_id)
    if not route_id:
        return json_error("UNKNOWN_ROUTE", "This Oswego route is not supported.", 404)

    direction = (request.args.get("direction") or "").strip()
    if not direction:
        return json_error("MISSING_DIRECTION", "Choose a route direction.", 400)

    client = _resolve_client()
    body = client.stops(route_id, direction)
    items = body.get("stops") or body.get("stop") or []
    result = [
        {
            "id": str(item.get("stpid")),
            "name": item.get("stpnm") or f"Stop {item.get('stpid')}",
            "lat": float(item["lat"]) if item.get("lat") is not None else None,
            "lng": float(item["lon"]) if item.get("lon") is not None else None,
        }
        for item in items
        if item.get("stpid")
    ]
    return jsonify({
        "routeId": route_id,
        "direction": direction,
        "stops": result,
        "message": None if result else first_upstream_message(body, "No stops are available."),
        "meta": meta(live=True),
    })
