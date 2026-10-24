"""Where's-my-bus math over raw Centro BusTime v3 dicts.

pdist (feet along a pattern) is only comparable within one pattern, so every
comparison here stays inside a single pattern. When the answer isn't known,
functions return None rather than a guess.
"""
from __future__ import annotations

from ..utils import parse_bustime


def stop_points(pattern: dict) -> list[dict]:
    points = sorted(pattern.get("pt") or [], key=lambda p: int(p.get("seq") or 0))
    return [
        {
            "stpid": str(p["stpid"]),
            "pdist": float(p.get("pdist") or 0),
            "name": p.get("stpnm"),
            "lat": float(p["lat"]) if p.get("lat") is not None else None,
            "lng": float(p["lon"]) if p.get("lon") is not None else None,
        }
        for p in points
        if p.get("typ") == "S" and p.get("stpid")
    ]


def _occurrence(points: list[dict], stop_id: str, from_pdist: float = 0.0) -> int | None:
    # Loop routes visit a stop twice; the next occurrence is the one at or
    # after the bus.
    for index, point in enumerate(points):
        if point["stpid"] == stop_id and point["pdist"] >= from_pdist:
            return index
    return None


def _direction(pattern: dict) -> str:
    return str(pattern.get("rtdir") or "")


def parse_countdown(prediction: dict) -> tuple[int | None, bool]:
    raw = str(prediction.get("prdctdn", "")).strip().upper()
    if raw == "DUE":
        return 0, True
    try:
        return int(raw), False
    except ValueError:
        return None, False


def pick_tracked_bus(
    stop_id: str,
    direction: str,
    stop_predictions: list[dict],
    vehicles: list[dict],
    patterns_by_pid: dict[str, dict],
) -> dict | None:
    if stop_predictions:
        def order(p):
            minutes, _ = parse_countdown(p)
            return (p.get("prdtm") or "~", minutes if minutes is not None else 10_000)

        vehicle_id = str(min(stop_predictions, key=order).get("vid") or "")
        if not vehicle_id:
            return None
        for vehicle in vehicles:
            if str(vehicle.get("vid")) == vehicle_id:
                return vehicle
        return {"vid": vehicle_id}

    same_direction, opposite = [], []
    for vehicle in vehicles:
        pattern = patterns_by_pid.get(str(vehicle.get("pid")))
        if pattern is None:
            continue
        bus_pdist = float(vehicle.get("pdist") or 0)
        if _direction(pattern) == direction:
            points = stop_points(pattern)
            index = _occurrence(points, stop_id, bus_pdist)
            if index is not None:
                same_direction.append((points[index]["pdist"] - bus_pdist, vehicle))
        else:
            opposite.append((float(pattern.get("ln") or 0) - bus_pdist, vehicle))

    for candidates in (same_direction, opposite):
        if candidates:
            return min(candidates, key=lambda pair: pair[0])[1]
    return None


def candidate_boarding_patterns(
    stop_id: str,
    direction: str,
    patterns: list[dict],
    bus: dict | None,
    bus_predictions: list[dict],
) -> list[dict]:
    """Variants of the student's direction the bus may use to reach the stop, best first."""
    candidates = [
        p for p in patterns
        if _direction(p) == direction and any(pt["stpid"] == stop_id for pt in stop_points(p))
    ]
    if bus:
        for pattern in candidates:
            if str(pattern.get("pid")) == str(bus.get("pid")):
                return [pattern]

    def by_size(items):
        return sorted(items, key=lambda p: len(stop_points(p)), reverse=True)

    wanted = {str(p.get("stpid")) for p in bus_predictions if p.get("rtdir") == direction}
    if wanted:
        matching = [
            p for p in candidates
            if wanted <= {pt["stpid"] for pt in stop_points(p)}
        ]
        # A longer variant always contains a shorter one's stops, so prefer
        # variants with no unpredicted stops inside the predicted stretch:
        # a stop the bus will visit within that stretch would be predicted.
        tight = [p for p in matching if _covers_contiguously(p, wanted)]
        if tight:
            return by_size(tight)
        if matching:
            return by_size(matching)
    return by_size(candidates)


def boarding_pattern(
    stop_id: str,
    direction: str,
    patterns: list[dict],
    bus: dict | None,
    bus_predictions: list[dict],
) -> dict | None:
    candidates = candidate_boarding_patterns(stop_id, direction, patterns, bus, bus_predictions)
    return candidates[0] if candidates else None


def _covers_contiguously(pattern: dict, wanted: set[str]) -> bool:
    ids = [pt["stpid"] for pt in stop_points(pattern)]
    positions = [index for index, stop_id in enumerate(ids) if stop_id in wanted]
    if not positions:
        return False
    return all(stop_id in wanted for stop_id in ids[positions[0]: positions[-1] + 1])


def turnaround_confirmed(bus: dict, direction: str, bus_predictions: list[dict]) -> bool:
    own_trip = str(bus.get("tatripid") or "")
    return any(
        p.get("rtdir") == direction and str(p.get("tatripid") or "") != own_trip
        for p in bus_predictions
    )


def stops_away(
    stop_id: str,
    direction: str,
    bus: dict,
    bus_pattern: dict | None,
    board_pattern: dict | None,
    bus_predictions: list[dict],
) -> int | None:
    if not bus or bus_pattern is None or board_pattern is None or bus.get("pdist") is None:
        return None
    bus_pdist = float(bus["pdist"])
    bus_points = stop_points(bus_pattern)

    if _direction(bus_pattern) == direction:
        index = _occurrence(bus_points, stop_id, bus_pdist)
        if index is None:
            return None
        # A stop at the bus's own pdist is where it is now, not ahead of it.
        return sum(1 for point in bus_points[: index + 1] if point["pdist"] > bus_pdist)

    if not turnaround_confirmed(bus, direction, bus_predictions):
        return None
    remaining = [point for point in bus_points if point["pdist"] > bus_pdist]
    board_points = stop_points(board_pattern)
    index = _occurrence(board_points, stop_id)
    if index is None:
        return None
    next_leg = board_points[: index + 1]
    # The last stop of this trip is usually the first stop of the next one.
    if remaining and next_leg and remaining[-1]["stpid"] == next_leg[0]["stpid"]:
        next_leg = next_leg[1:]
    return len(remaining) + len(next_leg)


def agreed_stops_away(
    stop_id: str,
    direction: str,
    bus: dict,
    bus_pattern: dict | None,
    candidates: list[dict],
    bus_predictions: list[dict],
) -> int | None:
    # When Centro's data fits more than one variant and they disagree, a
    # count would be a guess.
    counts = {
        stops_away(stop_id, direction, bus, bus_pattern, candidate, bus_predictions)
        for candidate in candidates
    } or {None}
    return counts.pop() if len(counts) == 1 else None


def stop_timeline(
    stop_id: str,
    direction: str,
    bus: dict | None,
    bus_pattern: dict | None,
    board_pattern: dict,
    bus_predictions: list[dict],
) -> tuple[list[dict], str | None]:
    points = stop_points(board_pattern)
    on_this_pattern = bool(
        bus and bus_pattern and bus.get("pdist") is not None
        and str(bus_pattern.get("pid")) == str(board_pattern.get("pid"))
    )
    bus_pdist = float(bus["pdist"]) if on_this_pattern else None

    boarding_index = _occurrence(points, stop_id, bus_pdist or 0.0)
    if boarding_index is None:
        boarding_index = _occurrence(points, stop_id)

    times: dict[str, dict] = {}
    for prediction in bus_predictions:
        if prediction.get("rtdir") != direction:
            continue
        key = str(prediction.get("stpid"))
        if key not in times or (prediction.get("prdtm") or "~") < (times[key].get("prdtm") or "~"):
            times[key] = prediction

    entries, bus_after = [], None
    for index, point in enumerate(points):
        passed = bus_pdist is not None and point["pdist"] < bus_pdist
        minutes, due, predicted_at = None, False, None
        if not passed and point["stpid"] in times:
            minutes, due = parse_countdown(times[point["stpid"]])
            parsed = parse_bustime(times[point["stpid"]].get("prdtm"))
            predicted_at = parsed.isoformat(timespec="seconds") if parsed else None
        if passed:
            bus_after = point["stpid"]
        entries.append({
            "id": point["stpid"],
            "name": point["name"],
            "lat": point["lat"],
            "lng": point["lng"],
            "state": "passed" if passed else "upcoming",
            "minutes": minutes,
            "due": due,
            "predictedAt": predicted_at,
            "isBoarding": index == boarding_index,
        })
    return entries, bus_after
