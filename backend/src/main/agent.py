"""Background collector for optional historical Centro prediction storage.

The web app reads live data through ``app.py``.  This collector is only needed
when the project wants to retain BusTime prediction snapshots in MySQL.
"""

from __future__ import annotations

import os
import time
from datetime import datetime
from pathlib import Path

import pymysql

try:
    from .catalog import OSWEGO_ROUTE_IDS, ROUTE_METADATA
    from .centro_client import CentroAPIError, CentroClient
except ImportError:
    from catalog import OSWEGO_ROUTE_IDS, ROUTE_METADATA
    from centro_client import CentroAPIError, CentroClient


PROJECT_ROOT = Path(__file__).resolve().parents[3]


def load_local_environment():
    env_path = PROJECT_ROOT / "backend" / ".env"
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def required_environment(name):
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def connect_to_db():
    return pymysql.connect(
        host=required_environment("DB_HOST"),
        user=required_environment("DB_USER"),
        password=required_environment("DB_PASSWORD"),
        database=required_environment("DB_NAME"),
    )


def parse_bustime(value):
    for pattern in ("%Y%m%d %H:%M:%S", "%Y%m%d %H:%M"):
        try:
            return datetime.strptime(value, pattern)
        except (TypeError, ValueError):
            continue
    raise ValueError(f"Unsupported Centro timestamp: {value!r}")


def chunks(values, size=10):
    for index in range(0, len(values), size):
        yield values[index : index + size]


def discover_stops(client, route_id):
    directions_body = client.directions(route_id)
    directions = directions_body.get("directions") or []
    discovered = {}

    for direction in directions:
        direction_id = direction.get("id") or direction.get("name")
        if not direction_id:
            continue
        stops_body = client.stops(route_id, direction_id)
        for stop in stops_body.get("stops") or []:
            stop_id = str(stop.get("stpid") or "")
            if stop_id:
                discovered[stop_id] = stop.get("stpnm") or f"Stop {stop_id}"

    return discovered


def fetch_route_predictions(client, route_id, stop_ids):
    predictions = []
    for stop_batch in chunks(list(stop_ids), 10):
        body = client.request(
            "getpredictions",
            rt=route_id,
            stpid=",".join(stop_batch),
        )
        predictions.extend(body.get("prd") or [])
    return predictions


def store_snapshot(route_id, stops, predictions):
    if not predictions:
        return 0

    connection = connect_to_db()
    inserted = 0

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO Routes (rt, des)
                VALUES (%s, %s)
                ON DUPLICATE KEY UPDATE des = VALUES(des)
                """,
                (route_id, ROUTE_METADATA[route_id]["fallbackName"]),
            )

            for stop_id, stop_name in stops.items():
                cursor.execute(
                    """
                    INSERT INTO Stops (stupid, stpnm)
                    VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE stpnm = VALUES(stpnm)
                    """,
                    (stop_id, stop_name),
                )

            seen = set()
            for prediction in predictions:
                if prediction.get("msg") == "No service scheduled":
                    continue

                stop_id = str(prediction.get("stpid") or "")
                if not stop_id:
                    continue

                identity = (
                    stop_id,
                    str(prediction.get("vid") or ""),
                    str(prediction.get("prdtm") or ""),
                    str(prediction.get("tmstmp") or ""),
                )
                if identity in seen:
                    continue
                seen.add(identity)

                raw_countdown = str(prediction.get("prdctdn", "")).upper()
                if raw_countdown == "DUE":
                    minutes = 0
                elif raw_countdown == "MISSING":
                    minutes = -1
                else:
                    minutes = int(raw_countdown)

                cursor.execute(
                    """
                    INSERT IGNORE INTO ETA
                        (stpid, rt, prdtm, prdctdn, tmstmp, dly, rtdir)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        stop_id,
                        route_id,
                        parse_bustime(prediction.get("prdtm")),
                        minutes,
                        parse_bustime(prediction.get("tmstmp")),
                        bool(prediction.get("dly")),
                        prediction.get("rtdir"),
                    ),
                )
                inserted += cursor.rowcount

        connection.commit()
        return inserted
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def collect_once(client):
    total = 0
    for route_id in OSWEGO_ROUTE_IDS:
        try:
            stops = discover_stops(client, route_id)
            predictions = fetch_route_predictions(client, route_id, stops.keys())
            inserted = store_snapshot(route_id, stops, predictions)
            total += inserted
            print(
                f"{route_id}: {len(stops)} stops, "
                f"{len(predictions)} live predictions, {inserted} stored"
            )
        except CentroAPIError as error:
            print(f"{route_id}: Centro unavailable ({error})")
        except Exception as error:
            print(f"{route_id}: collection failed ({type(error).__name__})")
    return total


def is_operating_time():
    current = datetime.now().time()
    start = datetime.strptime("05:00:00", "%H:%M:%S").time()
    end = datetime.strptime("23:00:00", "%H:%M:%S").time()
    return start <= current <= end


def main():
    load_local_environment()
    client = CentroClient(required_environment("CENTRO_API_KEY"))

    while True:
        if is_operating_time():
            inserted = collect_once(client)
            print(f"Snapshot complete: {inserted} predictions stored")
        else:
            print("Outside the configured 5 AM–11 PM collection window")
        time.sleep(60)


if __name__ == "__main__":
    main()
