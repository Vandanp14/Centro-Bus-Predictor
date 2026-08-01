from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from .catalog import OSWEGO_ROUTE_IDS

SERVICE_TZ = ZoneInfo("America/New_York")


def now_iso() -> str:
    return datetime.now(SERVICE_TZ).isoformat(timespec="seconds")


def parse_bustime(value):
    if not value:
        return None
    for pattern in ("%Y%m%d %H:%M:%S", "%Y%m%d %H:%M"):
        try:
            return datetime.strptime(str(value), pattern).replace(tzinfo=SERVICE_TZ)
        except ValueError:
            continue
    return None


def iso_bustime(value):
    parsed = parse_bustime(value)
    return parsed.isoformat(timespec="seconds") if parsed else None


def first_upstream_message(body, fallback):
    errors = body.get("error") or []
    if errors and isinstance(errors[0], dict):
        message = (errors[0].get("msg") or "").strip()
        if message.lower() == "no data found for parameter":
            return fallback
        return message or fallback
    return fallback


def validate_route(route_id):
    normalized = (route_id or "").upper()
    if normalized not in OSWEGO_ROUTE_IDS:
        return None
    return normalized


def meta(**extra):
    return {
        "source": "Centro BusTime",
        "serverTime": now_iso(),
        **extra,
    }
