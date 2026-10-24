from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request

from flask import current_app

from ..services.centro_client import CentroAPIError, get_client
from ..utils import (
    first_upstream_message,
    meta,
    parse_bustime,
    SERVICE_TZ,
    validate_route,
)
from ..middleware.request_id import json_error

blueprint = Blueprint("predictions", __name__)

BEYOND_WINDOW_MESSAGE = (
    "A bus is running on this route, but it is more than about 45 minutes "
    "from this stop. Centro posts times once the bus is within 45 minutes."
)
NO_SERVICE_MESSAGE = "No bus is running on this route right now."


def _resolve_client():
    client = current_app.config.get("CENTRO_CLIENT")
    if client is not None:
        return client
    return get_client()


@blueprint.get("/api/v1/predictions")
def predictions():
    route_id = validate_route(request.args.get("route"))
    stop_id = (request.args.get("stop") or "").strip()
    direction = (request.args.get("direction") or "").strip() or None

    if not route_id:
        return json_error("UNKNOWN_ROUTE", "Choose a supported Oswego route.", 400)
    if not stop_id.isdigit():
        return json_error("INVALID_STOP", "Choose a valid Centro stop.", 400)

    client = _resolve_client()
    body = client.predictions(route_id, stop_id, direction)
    items = body.get("prd") or []
    now = datetime.now(SERVICE_TZ)
    result = []

    for item in items:
        item_direction = item.get("rtdir")
        if direction and item_direction and item_direction != direction:
            continue

        observed_at = parse_bustime(item.get("tmstmp"))
        predicted_at = parse_bustime(item.get("prdtm"))
        raw_countdown = str(item.get("prdctdn", "")).strip().upper()
        due = raw_countdown == "DUE"
        try:
            minutes = 0 if due else int(raw_countdown)
        except (TypeError, ValueError):
            minutes = None

        result.append({
            "routeId": str(item.get("rt") or route_id),
            "stopId": str(item.get("stpid") or stop_id),
            "stopName": item.get("stpnm"),
            "direction": item_direction or direction,
            "destination": item.get("des"),
            "vehicleId": str(item.get("vid")) if item.get("vid") else None,
            "minutes": minutes,
            "due": due,
            "delayed": bool(item.get("dly")),
            "predictionType": item.get("typ"),
            "observedAt": observed_at.isoformat(timespec="seconds") if observed_at else None,
            "predictedAt": predicted_at.isoformat(timespec="seconds") if predicted_at else None,
        })

    result.sort(key=lambda item: (
        item["predictedAt"] is None,
        item["predictedAt"] or "",
        item["minutes"] if item["minutes"] is not None else 10_000,
    ))

    newest_observation = max(
        (parse_bustime(item.get("tmstmp")) for item in items if item.get("tmstmp")),
        default=None,
    )
    stale = bool(newest_observation and now - newest_observation > timedelta(minutes=3))

    # Centro says "No service scheduled" both when nothing runs and when the
    # bus is beyond its ~45 minute prediction window, so check live vehicles.
    active_vehicles = None
    if result:
        status, message = "live", None
    else:
        try:
            vehicles_body = client.vehicles(route_id)
            active_vehicles = len(vehicles_body.get("vehicle") or vehicles_body.get("vehicles") or [])
        except CentroAPIError:
            active_vehicles = None
        if active_vehicles:
            status, message = "beyond_window", BEYOND_WINDOW_MESSAGE
        elif active_vehicles == 0:
            status, message = "no_service", NO_SERVICE_MESSAGE
        else:
            status, message = "unknown", first_upstream_message(body, "No upcoming predictions.")

    return jsonify({
        "routeId": route_id,
        "stopId": stop_id,
        "direction": direction,
        "predictions": result,
        "status": status,
        "activeVehicles": active_vehicles,
        "message": message,
        "meta": meta(
            live=True,
            stale=stale,
            sourceTime=newest_observation.isoformat(timespec="seconds") if newest_observation else None,
        ),
    })
