from __future__ import annotations

from .utils import first_upstream_message

BEYOND_WINDOW_MESSAGE = (
    "A bus is running on this route, but it is more than about 45 minutes "
    "from this stop. Centro posts times once the bus is within 45 minutes."
)
NO_SERVICE_MESSAGE = "No bus is running on this route right now."


def count_vehicles(body: dict) -> int:
    return len(body.get("vehicle") or body.get("vehicles") or [])


def classify_empty(active_vehicles: int | None, upstream_body: dict) -> tuple[str, str]:
    # Centro says "No service scheduled" both when nothing runs and when the
    # bus is beyond its ~45 minute prediction window, so live vehicles decide.
    if active_vehicles:
        return "beyond_window", BEYOND_WINDOW_MESSAGE
    if active_vehicles == 0:
        return "no_service", NO_SERVICE_MESSAGE
    return "unknown", first_upstream_message(upstream_body, "No upcoming predictions.")
