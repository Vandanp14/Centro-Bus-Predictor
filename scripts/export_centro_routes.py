"""Export Centro's route catalog to docs/centro-routes.{md,json} for reference.

Usage: python3 scripts/export_centro_routes.py

Reads CENTRO_API_KEY from the environment, falling back to backend/.env or
api/.env. The key is never written to the output files.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from api.src.catalog import OSWEGO_ROUTE_IDS, ROUTE_METADATA  # noqa: E402

BASE = "https://bus-time.centro.org/bustime/api/v3"
REGIONS = {
    "OSW": "Oswego", "FUL": "Fulton", "MEX": "Mexico", "SY": "Syracuse",
    "SYRCC": "Syracuse", "SU": "Syracuse University", "AUB": "Auburn",
    "COR": "Cortland", "ROME": "Rome", "UT": "Utica",
}


def api_key() -> str:
    if os.environ.get("CENTRO_API_KEY"):
        return os.environ["CENTRO_API_KEY"].strip()
    for env in (ROOT / "backend" / ".env", ROOT / "api" / ".env"):
        if env.is_file():
            for line in env.read_text(encoding="utf-8").splitlines():
                if line.startswith("CENTRO_API_KEY="):
                    return line.split("=", 1)[1].strip().strip("\"'")
    sys.exit("CENTRO_API_KEY is not set (env, backend/.env or api/.env).")


KEY = api_key()
session = requests.Session()


def get(endpoint: str, **params) -> dict:
    response = session.get(
        f"{BASE}/{endpoint}",
        params={"key": KEY, "format": "json", **params},
        timeout=20,
    )
    response.raise_for_status()
    return response.json().get("bustime-response", {})


def ordered_stops(stops: list[dict], patterns: list[dict], direction: str):
    """Mirror the API's ordering: pattern sequence first, the rest after."""
    rank: dict[str, int] = {}
    sequences = [
        [
            str(pt["stpid"])
            for pt in sorted(p.get("pt") or [], key=lambda pt: int(pt.get("seq") or 0))
            if pt.get("typ") == "S" and pt.get("stpid")
        ]
        for p in patterns
        if str(p.get("rtdir") or "") == direction
    ]
    for sequence in sorted(sequences, key=len, reverse=True):
        for stop_id in sequence:
            rank.setdefault(stop_id, len(rank))
    ordered = sorted(
        enumerate(stops),
        key=lambda pair: (pair[1]["id"] not in rank, rank.get(pair[1]["id"], 0), pair[0]),
    )
    return [stop for _, stop in ordered], ("route" if rank else "alphabetical")


def region(route_id: str) -> str:
    prefix = route_id if route_id in REGIONS else re.match(r"[A-Z]+", route_id).group()
    return REGIONS.get(prefix, prefix)


def main() -> None:
    routes = get("getroutes").get("routes", [])
    export = {"generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"), "routes": []}

    for route in routes:
        route_id = route["rt"]
        in_app = route_id in OSWEGO_ROUTE_IDS
        entry = {
            "id": route_id,
            "name": route.get("rtnm"),
            "region": region(route_id),
            "centroColor": route.get("rtclr"),
            "inApp": in_app,
            "scheduleUrl": ROUTE_METADATA.get(route_id, {}).get("scheduleUrl"),
            "directions": [],
            "patterns": None,
        }
        patterns = get("getpatterns", rt=route_id).get("ptr", [])
        if in_app:
            # getpatterns only lists currently-active patterns; add the ones
            # live buses are on so both directions are captured.
            known = {str(p["pid"]) for p in patterns}
            for vehicle in get("getvehicles", rt=route_id).get("vehicle", []):
                if vehicle.get("pid") and str(vehicle["pid"]) not in known:
                    patterns += get("getpatterns", pid=vehicle["pid"]).get("ptr", [])
                    known.add(str(vehicle["pid"]))
        for direction in get("getdirections", rt=route_id).get("directions", []):
            direction_id = direction.get("id") or direction.get("name")
            stops = [
                {
                    "id": str(s["stpid"]),
                    "name": s.get("stpnm"),
                    "lat": s.get("lat"),
                    "lng": s.get("lon"),
                }
                for s in get("getstops", rt=route_id, dir=direction_id).get("stops", [])
            ]
            stops, order = ordered_stops(stops, patterns, direction_id)
            entry["directions"].append({
                "id": direction_id,
                "stopCount": len(stops),
                "stopOrder": order,
                "stops": stops if in_app else None,
            })
        if in_app:
            entry["patterns"] = [
                {
                    "pid": p.get("pid"),
                    "rtdir": p.get("rtdir"),
                    "ln": p.get("ln"),
                    "pt": [
                        {k: pt.get(k) for k in ("seq", "typ", "stpid", "stpnm", "pdist", "lat", "lon")}
                        for pt in p.get("pt") or []
                    ],
                }
                for p in patterns
            ]
        export["routes"].append(entry)
        print(f"{route_id}: {len(entry['directions'])} directions", file=sys.stderr)

    docs = ROOT / "docs"
    merge_previous_patterns(export, docs / "centro-routes.json")
    (docs / "centro-routes.json").write_text(json.dumps(export, indent=2) + "\n", encoding="utf-8")
    (docs / "centro-routes.md").write_text(render_markdown(export), encoding="utf-8")


def merge_previous_patterns(export: dict, previous_path: Path) -> None:
    """Keep patterns from earlier runs that Centro no longer lists as active.

    getpatterns only returns currently-active patterns, so a run at one hour
    may see one direction and a run at another hour the other.
    """
    try:
        previous = json.loads(previous_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return
    old_by_route = {r["id"]: r.get("patterns") or [] for r in previous.get("routes", [])}
    for route in export["routes"]:
        if route["patterns"] is None:
            continue
        seen = {str(p["pid"]) for p in route["patterns"]}
        route["patterns"] += [p for p in old_by_route.get(route["id"], []) if str(p["pid"]) not in seen]


def render_markdown(export: dict) -> str:
    lines = [
        "# Centro routes reference",
        "",
        f"Generated {export['generatedAt']} from Centro BusTime v3 by "
        "`scripts/export_centro_routes.py`. Rerun the script to refresh it.",
        "",
        "Routes marked **in app** are the ones Centro Oswego Live shows, chosen for SUNY Oswego "
        "students. Full ordered stop lists for those routes follow the table; "
        "`docs/centro-routes.json` has the same data with coordinates.",
        "",
        "Stop order comes from Centro's route patterns. A direction marked "
        "*alphabetical* had no pattern from Centro when this file was generated, so its "
        "stops are listed alphabetically.",
        "",
        "## All Centro routes",
        "",
        "| Route | Name | Region | In app | Directions (stops) |",
        "| --- | --- | --- | --- | --- |",
    ]
    for r in sorted(export["routes"], key=lambda r: (not r["inApp"], r["region"], r["id"])):
        dirs = ", ".join(f"{d['id']} ({d['stopCount']})" for d in r["directions"]) or "none reported"
        lines.append(f"| {r['id']} | {r['name']} | {r['region']} | {'**in app**' if r['inApp'] else ''} | {dirs} |")

    by_id = {r["id"]: r for r in export["routes"]}
    for route_id in OSWEGO_ROUTE_IDS:
        r = by_id.get(route_id)
        if not r:
            lines += ["", f"## {route_id}", "", "Not returned by Centro when this file was generated."]
            continue
        lines += ["", f"## {r['id']} · {r['name']}", ""]
        if r["scheduleUrl"]:
            lines += [f"Official schedule: {r['scheduleUrl']}", ""]
        for d in r["directions"]:
            lines += [f"### {d['id']} — {d['stopCount']} stops ({d['stopOrder']} order)", ""]
            lines += ["| # | Stop ID | Stop |", "| --- | --- | --- |"]
            lines += [f"| {i} | {s['id']} | {s['name']} |" for i, s in enumerate(d["stops"], 1)]
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


if __name__ == "__main__":
    main()
