"""Flask API and SPA host for the Centro Oswego live-arrivals app."""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from flask import Flask, g, jsonify, request, send_from_directory
from flask_cors import CORS

try:  # Package import when executed with ``python -m``.
    from .catalog import OSWEGO_ROUTE_IDS, ROUTE_METADATA, catalog_routes
    from .centro_client import CentroAPIError, CentroClient
except ImportError:  # Script import for the existing deployment command.
    from catalog import OSWEGO_ROUTE_IDS, ROUTE_METADATA, catalog_routes
    from centro_client import CentroAPIError, CentroClient


LOGGER = logging.getLogger(__name__)
SERVICE_TZ = ZoneInfo("America/New_York")
PROJECT_ROOT = Path(__file__).resolve().parents[3]
BUILD_DIR = PROJECT_ROOT / "build"


def _load_local_environment() -> None:
    """Load backend/.env for local development without adding a dependency.

    Existing process environment values always win.  Production should inject
    configuration through its service manager instead of relying on this file.
    """

    env_path = PROJECT_ROOT / "backend" / ".env"
    if not env_path.is_file():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("\"'")
        if key:
            os.environ.setdefault(key, value)


def _now_iso() -> str:
    return datetime.now(SERVICE_TZ).isoformat(timespec="seconds")


def _parse_bustime(value):
    if not value:
        return None
    for pattern in ("%Y%m%d %H:%M:%S", "%Y%m%d %H:%M"):
        try:
            return datetime.strptime(str(value), pattern).replace(tzinfo=SERVICE_TZ)
        except ValueError:
            continue
    return None


def _iso_bustime(value):
    parsed = _parse_bustime(value)
    return parsed.isoformat(timespec="seconds") if parsed else None


def _first_upstream_message(body, fallback):
    errors = body.get("error") or []
    if errors and isinstance(errors[0], dict):
        message = (errors[0].get("msg") or "").strip()
        if message.lower() == "no data found for parameter":
            return fallback
        return message or fallback
    return fallback


def _validate_route(route_id):
    normalized = (route_id or "").upper()
    if normalized not in OSWEGO_ROUTE_IDS:
        return None
    return normalized


def _error(code, message, status):
    return (
        jsonify(
            {
                "error": {
                    "code": code,
                    "message": message,
                    "requestId": getattr(g, "request_id", None),
                }
            }
        ),
        status,
    )


def _meta(**extra):
    return {
        "source": "Centro BusTime",
        "serverTime": _now_iso(),
        **extra,
    }


def create_app(*, centro_client=None, testing=False):
    _load_local_environment()

    app = Flask(__name__, static_folder=None)
    app.config.update(TESTING=testing)
    app.config["CENTRO_CLIENT"] = centro_client or CentroClient(
        os.environ.get("CENTRO_API_KEY")
    )

    allowed_origins = [
        origin.strip()
        for origin in os.environ.get(
            "CORS_ORIGINS",
            "http://localhost:3000,http://localhost:3001,http://localhost:3002,"
            "http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002",
        ).split(",")
        if origin.strip()
    ]
    CORS(
        app,
        resources={r"/api/v1/*": {"origins": allowed_origins}},
        supports_credentials=False,
    )

    @app.before_request
    def assign_request_id():
        g.request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]

    @app.after_request
    def add_response_headers(response):
        response.headers["X-Request-ID"] = g.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        if request.path.startswith("/api/v1/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.errorhandler(CentroAPIError)
    def handle_centro_error(error):
        return _error("CENTRO_UNAVAILABLE", str(error), error.status_code)

    @app.errorhandler(404)
    def handle_not_found(_error_value):
        if request.path.startswith("/api/"):
            return _error("NOT_FOUND", "API endpoint not found.", 404)
        return _serve_spa(request.path.lstrip("/"))

    @app.errorhandler(Exception)
    def handle_unexpected_error(error):
        LOGGER.exception("Unhandled request %s", g.request_id, exc_info=error)
        return _error(
            "INTERNAL_ERROR",
            "The server could not complete this request.",
            500,
        )

    def client():
        return app.config["CENTRO_CLIENT"]

    @app.get("/api/v1/health")
    def health():
        configured = bool(client().configured)
        return jsonify(
            {
                "status": "ok" if configured else "degraded",
                "configured": configured,
                "meta": _meta(),
            }
        )

    @app.get("/api/v1/routes")
    def routes():
        catalog = {route["id"]: route for route in catalog_routes()}
        live = True
        message = None

        try:
            body = client().routes()
            upstream_routes = body.get("routes") or body.get("route") or []
            for route in upstream_routes:
                route_id = str(route.get("rt", "")).upper()
                if route_id not in catalog:
                    continue
                catalog[route_id]["name"] = (
                    route.get("rtnm") or catalog[route_id]["fallbackName"]
                )
                catalog[route_id]["upstreamColor"] = route.get("rtclr")
        except CentroAPIError as error:
            live = False
            message = str(error)

        ordered = [catalog[route_id] for route_id in OSWEGO_ROUTE_IDS]
        return jsonify(
            {
                "routes": ordered,
                "meta": _meta(live=live, message=message),
            }
        )

    @app.get("/api/v1/routes/<route_id>/directions")
    def directions(route_id):
        route_id = _validate_route(route_id)
        if not route_id:
            return _error("UNKNOWN_ROUTE", "This Oswego route is not supported.", 404)

        body = client().directions(route_id)
        items = body.get("directions") or body.get("dir") or []
        result = [
            {
                "id": str(item.get("id") or item.get("name") or ""),
                "name": str(item.get("name") or item.get("id") or ""),
            }
            for item in items
            if item.get("id") or item.get("name")
        ]
        return jsonify(
            {
                "routeId": route_id,
                "directions": result,
                "message": None
                if result
                else _first_upstream_message(body, "No directions are available."),
                "meta": _meta(live=True),
            }
        )

    @app.get("/api/v1/routes/<route_id>/stops")
    def stops(route_id):
        route_id = _validate_route(route_id)
        if not route_id:
            return _error("UNKNOWN_ROUTE", "This Oswego route is not supported.", 404)

        direction = (request.args.get("direction") or "").strip()
        if not direction:
            return _error("MISSING_DIRECTION", "Choose a route direction.", 400)

        body = client().stops(route_id, direction)
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
        return jsonify(
            {
                "routeId": route_id,
                "direction": direction,
                "stops": result,
                "message": None
                if result
                else _first_upstream_message(body, "No stops are available."),
                "meta": _meta(live=True),
            }
        )

    @app.get("/api/v1/predictions")
    def predictions():
        route_id = _validate_route(request.args.get("route"))
        stop_id = (request.args.get("stop") or "").strip()
        direction = (request.args.get("direction") or "").strip() or None

        if not route_id:
            return _error("UNKNOWN_ROUTE", "Choose a supported Oswego route.", 400)
        if not stop_id.isdigit():
            return _error("INVALID_STOP", "Choose a valid Centro stop.", 400)

        body = client().predictions(route_id, stop_id, direction)
        items = body.get("prd") or []
        now = datetime.now(SERVICE_TZ)
        result = []

        for item in items:
            item_direction = item.get("rtdir")
            if direction and item_direction and item_direction != direction:
                continue

            observed_at = _parse_bustime(item.get("tmstmp"))
            predicted_at = _parse_bustime(item.get("prdtm"))
            raw_countdown = str(item.get("prdctdn", "")).strip().upper()
            due = raw_countdown == "DUE"
            try:
                minutes = 0 if due else int(raw_countdown)
            except (TypeError, ValueError):
                minutes = None

            result.append(
                {
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
                    "observedAt": observed_at.isoformat(timespec="seconds")
                    if observed_at
                    else None,
                    "predictedAt": predicted_at.isoformat(timespec="seconds")
                    if predicted_at
                    else None,
                }
            )

        result.sort(
            key=lambda item: (
                item["predictedAt"] is None,
                item["predictedAt"] or "",
                item["minutes"] if item["minutes"] is not None else 10_000,
            )
        )
        newest_observation = max(
            (
                _parse_bustime(item.get("tmstmp"))
                for item in items
                if item.get("tmstmp")
            ),
            default=None,
        )
        stale = bool(
            newest_observation and now - newest_observation > timedelta(minutes=3)
        )

        return jsonify(
            {
                "routeId": route_id,
                "stopId": stop_id,
                "direction": direction,
                "predictions": result,
                "message": None
                if result
                else _first_upstream_message(body, "No upcoming predictions."),
                "meta": _meta(
                    live=True,
                    stale=stale,
                    sourceTime=newest_observation.isoformat(timespec="seconds")
                    if newest_observation
                    else None,
                ),
            }
        )

    @app.get("/api/v1/routes/<route_id>/vehicles")
    def vehicles(route_id):
        route_id = _validate_route(route_id)
        if not route_id:
            return _error("UNKNOWN_ROUTE", "This Oswego route is not supported.", 404)

        body = client().vehicles(route_id)
        items = body.get("vehicle") or body.get("vehicles") or []
        result = []
        for item in items:
            if item.get("lat") is None or item.get("lon") is None:
                continue
            result.append(
                {
                    "id": str(item.get("vid")),
                    "routeId": str(item.get("rt") or route_id),
                    "destination": item.get("des"),
                    "direction": item.get("rtdir"),
                    "lat": float(item["lat"]),
                    "lng": float(item["lon"]),
                    "heading": int(item.get("hdg") or 0),
                    "delayed": bool(item.get("dly")),
                    "updatedAt": _iso_bustime(item.get("tmstmp")),
                }
            )

        return jsonify(
            {
                "routeId": route_id,
                "vehicles": result,
                "message": None
                if result
                else _first_upstream_message(body, "No live buses on this route."),
                "meta": _meta(live=True),
            }
        )

    @app.get("/api/v1/routes/<route_id>/patterns")
    def patterns(route_id):
        route_id = _validate_route(route_id)
        if not route_id:
            return _error("UNKNOWN_ROUTE", "This Oswego route is not supported.", 404)

        requested_direction = (request.args.get("direction") or "").strip()
        body = client().patterns(route_id)
        items = body.get("ptr") or body.get("patterns") or []
        result = []

        for pattern in items:
            direction = str(pattern.get("rtdir") or "")
            if requested_direction and direction != requested_direction:
                continue

            points = []
            for point in pattern.get("pt") or []:
                if point.get("lat") is None or point.get("lon") is None:
                    continue
                points.append(
                    {
                        "sequence": int(point.get("seq") or len(points) + 1),
                        "lat": float(point["lat"]),
                        "lng": float(point["lon"]),
                        "type": point.get("typ"),
                        "stopId": str(point.get("stpid"))
                        if point.get("stpid")
                        else None,
                        "stopName": point.get("stpnm"),
                    }
                )

            result.append(
                {
                    "id": str(pattern.get("pid")),
                    "direction": direction,
                    "distance": pattern.get("ln"),
                    "points": points,
                }
            )

        return jsonify(
            {
                "routeId": route_id,
                "direction": requested_direction or None,
                "patterns": result,
                "message": None
                if result
                else _first_upstream_message(body, "No route shape is available."),
                "meta": _meta(live=True),
            }
        )

    def _serve_spa(path=""):
        requested_path = (BUILD_DIR / path).resolve()
        try:
            requested_path.relative_to(BUILD_DIR.resolve())
        except ValueError:
            return _error("NOT_FOUND", "File not found.", 404)

        if path and requested_path.is_file():
            return send_from_directory(BUILD_DIR, path)
        if (BUILD_DIR / "index.html").is_file():
            return send_from_directory(BUILD_DIR, "index.html")
        return jsonify(
            {
                "name": "Centro Oswego API",
                "message": "Frontend build not found. Run npm run build.",
                "api": "/api/v1/health",
            }
        )

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def serve_spa(path):
        if path.startswith("api/"):
            return _error("NOT_FOUND", "API endpoint not found.", 404)
        return _serve_spa(path)

    return app


app = create_app()


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "").lower() in {"1", "true", "yes"}
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5001")), debug=debug)
