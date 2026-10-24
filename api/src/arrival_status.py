from __future__ import annotations

from .utils import first_upstream_message

BEYOND_WINDOW_MESSAGE = (
    "A bus is running on this route, but it is more than about 45 minutes "
    "from this stop. Centro posts times once the bus is within 45 minutes."
)
NO_SERVICE_MESSAGE = "No bus is running on this route right now."


LAST_STOP_MESSAGE = (
    "Centro doesn't post arrival times for the last stop of a trip. "
    "If you're boarding here, choose the other direction."
)

NO_VEHICLES_MESSAGE = "no data found for parameter"


def count_vehicles(body: dict) -> int | None:
    """Live buses on the route, or None when Centro's answer says nothing.

    Centro reports "No data found for parameter" when no bus is reporting;
    any other error (rate limit, outage) must not read as "no service".
    """
    vehicles = body.get("vehicle") or body.get("vehicles") or []
    if vehicles:
        return len(vehicles)
    errors = body.get("error") or []
    messages = {str(e.get("msg") or "").strip().lower() for e in errors if isinstance(e, dict)}
    if messages - {NO_VEHICLES_MESSAGE}:
        return None
    return 0


def classify_empty(active_vehicles: int | None, upstream_body: dict) -> tuple[str, str]:
    # Centro says "No service scheduled" both when nothing runs and when the
    # bus is beyond its ~45 minute prediction window, so live vehicles decide.
    if active_vehicles:
        return "beyond_window", BEYOND_WINDOW_MESSAGE
    if active_vehicles == 0:
        return "no_service", NO_SERVICE_MESSAGE
    return "unknown", first_upstream_message(upstream_body, "No upcoming predictions.")
