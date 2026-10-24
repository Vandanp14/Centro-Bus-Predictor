from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, request

from ..arrival_status import classify_empty
from ..middleware.request_id import json_error
from ..services import trip as trip_math
from ..services.centro_client import CentroAPIError, get_client
from ..services.pattern_store import pattern_by_id, refresh
from ..utils import SERVICE_TZ, meta, parse_bustime, validate_route

blueprint = Blueprint("trip", __name__)


def _resolve_client():
    client = current_app.config.get("CENTRO_CLIENT")
    if client is not None:
        return client
    return get_client()


def _float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _arrival(prediction):
    if not prediction:
        return {"minutes": None, "due": False, "predictedAt": None}
    minutes, due = trip_math.parse_countdown(prediction)
    predicted_at = parse_bustime(prediction.get("prdtm"))
    return {
        "minutes": minutes,
        "due": due,
        "predictedAt": predicted_at.isoformat(timespec="seconds") if predicted_at else None,
    }


def _sorted_predictions(predictions):
    def order(p):
        minutes, _ = trip_math.parse_countdown(p)
        return (p.get("prdtm") or "~", minutes if minutes is not None else 10_000)

    return sorted(predictions, key=order)


@blueprint.get("/api/v1/trip")
def trip():
    route_id = validate_route(request.args.get("route"))
    stop_id = (request.args.get("stop") or "").strip()
    direction = (request.args.get("direction") or "").strip()

    if not route_id:
        return json_error("UNKNOWN_ROUTE", "This Oswego route is not supported.", 404)
    if not stop_id.isdigit():
        return json_error("INVALID_STOP", "Choose a valid Centro stop.", 400)
    if not direction:
        return json_error("MISSING_DIRECTION", "Choose a route direction.", 400)

    client = _resolve_client()
    # Only this call may fail the request; everything below degrades.
    stop_body = client.predictions(route_id, stop_id, direction)
    stop_predictions = _sorted_predictions([
        p for p in stop_body.get("prd") or []
        if not p.get("rtdir") or p.get("rtdir") == direction
    ])

    try:
        vehicles_body = client.vehicles(route_id)
        vehicles = vehicles_body.get("vehicle") or vehicles_body.get("vehicles") or []
        active_vehicles = len(vehicles)
    except CentroAPIError:
        vehicles, active_vehicles = [], None

    patterns_by_pid = {str(p["pid"]): p for p in refresh(client, route_id)}
    for vehicle in vehicles:
        pid = str(vehicle.get("pid") or "")
        if pid and pid not in patterns_by_pid:
            found = pattern_by_id(client, route_id, pid)
            if found is not None:
                patterns_by_pid[pid] = found

    bus = trip_math.pick_tracked_bus(stop_id, direction, stop_predictions, vehicles, patterns_by_pid)
    bus_predictions = []
    if bus:
        try:
            bus_predictions = client.predictions_for_vehicle(str(bus["vid"])).get("prd") or []
        except CentroAPIError:
            bus_predictions = []

    bus_pattern = patterns_by_pid.get(str(bus.get("pid"))) if bus else None
    board = trip_math.boarding_pattern(
        stop_id, direction, list(patterns_by_pid.values()), bus, bus_predictions,
    )
    stops, bus_after = (
        trip_math.stop_timeline(stop_id, direction, bus, bus_pattern, board, bus_predictions)
        if board else ([], None)
    )

    tracked_prediction = next(
        (p for p in stop_predictions if bus and str(p.get("vid")) == str(bus["vid"])),
        None,
    )
    # The stop's own prediction is the best time for the boarding stop, and
    # it survives a failed bus-predictions call.
    for entry in stops:
        if entry["isBoarding"] and entry["minutes"] is None and tracked_prediction:
            entry.update(_arrival(tracked_prediction))

    if stop_predictions:
        status, message = "live", None
    else:
        status, message = classify_empty(active_vehicles, stop_body)

    bus_payload = None
    if bus:
        bus_payload = {
            "id": str(bus["vid"]),
            "lat": _float(bus.get("lat")),
            "lng": _float(bus.get("lon")),
            "heading": int(_float(bus.get("hdg")) or 0),
            "destination": bus.get("des") or (tracked_prediction or {}).get("des"),
            "delayed": bool(bus.get("dly") or (tracked_prediction or {}).get("dly")),
            **_arrival(tracked_prediction),
            "stopsAway": trip_math.stops_away(
                stop_id, direction, bus, bus_pattern, board, bus_predictions,
            ),
            "onBoardingDirection": bool(bus_pattern and bus_pattern.get("rtdir") == direction),
        }

    other_vehicles = [
        {
            "id": str(v.get("vid")),
            "lat": _float(v.get("lat")),
            "lng": _float(v.get("lon")),
            "heading": int(_float(v.get("hdg")) or 0),
        }
        for v in vehicles
        if (not bus or str(v.get("vid")) != str(bus["vid"]))
        and _float(v.get("lat")) is not None and _float(v.get("lon")) is not None
    ]

    pattern_payload = None
    if board:
        points = sorted(board.get("pt") or [], key=lambda p: int(p.get("seq") or 0))
        pattern_payload = {
            "id": str(board["pid"]),
            "points": [
                {"lat": float(p["lat"]), "lng": float(p["lon"])}
                for p in points
                if p.get("lat") is not None and p.get("lon") is not None
            ],
        }

    following = [
        {
            **_arrival(p),
            "vehicleId": str(p.get("vid")) if p.get("vid") else None,
            "destination": p.get("des"),
        }
        for p in stop_predictions[1:4]
    ]

    observed = [
        parse_bustime(item.get("tmstmp"))
        for item in [*vehicles, *stop_predictions]
        if item.get("tmstmp")
    ]
    newest = max((o for o in observed if o), default=None)
    stale = bool(newest and datetime.now(SERVICE_TZ) - newest > timedelta(minutes=3))

    return jsonify({
        "routeId": route_id,
        "direction": direction,
        "stopId": stop_id,
        "status": status,
        "message": message,
        "bus": bus_payload,
        "stops": stops,
        "busAfterStopId": bus_after,
        "otherVehicles": other_vehicles,
        "pattern": pattern_payload,
        "following": following,
        "meta": meta(
            live=True,
            stale=stale,
            sourceTime=newest.isoformat(timespec="seconds") if newest else None,
        ),
    })
