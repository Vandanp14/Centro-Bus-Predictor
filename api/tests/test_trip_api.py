from datetime import datetime, timedelta

from api.src.arrival_status import BEYOND_WINDOW_MESSAGE, LAST_STOP_MESSAGE
from api.src.services.centro_client import CentroAPIError
from api.src.utils import SERVICE_TZ

from .trip_fixtures import OSW17_PATTERNS, P9757, P9775, prediction, vehicle

BOARDING = "15888"
URL = "/api/v1/trip?route=OSW17&direction=WESTBOUND&stop=" + BOARDING


def stamp(minutes_from_now=0):
    return (datetime.now(SERVICE_TZ) + timedelta(minutes=minutes_from_now)).strftime("%Y%m%d %H:%M")


def live(centro, **overrides):
    now = stamp()
    stop_predictions = [
        prediction(BOARDING, "WESTBOUND", "21", vid="2215", tatripid="T2", prdtm=stamp(21)),
        prediction(BOARDING, "WESTBOUND", "50", vid="2216", tatripid="T9", prdtm=stamp(50)),
    ]
    for p in stop_predictions:
        p["tmstmp"] = now
    centro.prediction_body = {"prd": stop_predictions}
    centro.vehicles_body = {"vehicle": [
        vehicle("2215", 9768, 2500, tatripid="T2", tmstmp=now),
        vehicle("2216", 9775, 1000, tatripid="T8", tmstmp=now),
    ]}
    centro.vehicle_predictions_body = {"prd": [
        prediction("17808", "WESTBOUND", "2", vid="2215", tatripid="T2", prdtm=stamp(2)),
        prediction(BOARDING, "WESTBOUND", "21", vid="2215", tatripid="T2", prdtm=stamp(21)),
    ]}
    centro.patterns_body = {"ptr": OSW17_PATTERNS}
    for key, value in overrides.items():
        setattr(centro, key, value)


def test_trip_live_payload(client, centro):
    live(centro)
    response = client.get(URL)
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "live"
    assert payload["bus"]["id"] == "2215"
    assert payload["bus"]["minutes"] == 21
    assert payload["bus"]["stopsAway"] == 5
    assert payload["bus"]["onBoardingDirection"] is True
    assert payload["bus"]["listPosition"] == "after_stop"
    assert {s["state"] for s in payload["stops"]} <= {"passed", "upcoming"}
    assert sum(s["isBoarding"] for s in payload["stops"]) == 1
    assert payload["pattern"]["id"] == "9768" and payload["pattern"]["points"]
    assert [v["id"] for v in payload["otherVehicles"]] == ["2216"]
    assert 1 <= len(payload["following"]) <= 3
    assert payload["following"][0]["vehicleId"] == "2216"
    assert payload["meta"]["stale"] is False


def test_trip_beyond_window_counts_stops(client, centro):
    live(centro, prediction_body={"error": [{"msg": "No service scheduled"}]}, vehicle_predictions_body={"prd": []})
    payload = client.get(URL).get_json()
    assert payload["status"] == "beyond_window"
    assert payload["message"] == BEYOND_WINDOW_MESSAGE
    assert payload["bus"]["id"] == "2215"
    assert payload["bus"]["minutes"] is None
    assert payload["bus"]["stopsAway"] == 5


def test_trip_no_service(client, centro):
    live(
        centro,
        prediction_body={"error": [{"msg": "No service scheduled"}]},
        vehicles_body={"error": [{"msg": "No data found for parameter"}]},
    )
    payload = client.get(URL).get_json()
    assert payload["status"] == "no_service"
    assert payload["bus"] is None
    assert [s["id"] for s in payload["stops"]][0] == "9614"


def test_trip_fetches_bus_pattern_by_pid(client, centro):
    live(centro, patterns_body={"ptr": [P9757, P9775]})
    centro.pattern_bodies = {"9768": {"ptr": [OSW17_PATTERNS[0]]}}
    payload = client.get(URL).get_json()
    assert ("pattern", ("9768",)) in centro.calls
    assert payload["bus"]["stopsAway"] == 5


def test_trip_degrades_when_patterns_fail(client, centro):
    live(centro, patterns_error=CentroAPIError("down"))
    response = client.get(URL)
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["stops"] == []
    assert payload["pattern"] is None
    assert payload["bus"]["stopsAway"] is None
    assert payload["bus"]["minutes"] == 21


def test_trip_degrades_when_bus_predictions_fail(client, centro):
    live(centro)

    def broken(_vehicle_id):
        raise CentroAPIError("down")

    centro.predictions_for_vehicle = broken
    payload = client.get(URL).get_json()
    assert payload["status"] == "live"
    by_id = {s["id"]: s for s in payload["stops"]}
    assert by_id["17808"]["minutes"] is None
    assert by_id[BOARDING]["minutes"] == 21


def test_trip_vehicle_without_position(client, centro):
    live(centro, vehicles_body={"vehicle": []})
    payload = client.get(URL).get_json()
    assert payload["bus"]["id"] == "2215"
    assert payload["bus"]["lat"] is None
    assert payload["bus"]["minutes"] == 21
    # Without its pattern position the list must not draw the bus anywhere.
    assert payload["bus"]["listPosition"] == "unknown"


def test_trip_stale_feed(client, centro):
    live(centro)
    old = stamp(-10)
    for item in centro.vehicles_body["vehicle"] + centro.prediction_body["prd"]:
        item["tmstmp"] = old
    assert client.get(URL).get_json()["meta"]["stale"] is True


def test_trip_validation(client):
    assert client.get("/api/v1/trip?route=OSW1A&direction=WESTBOUND&stop=1").status_code == 404
    bad_stop = client.get("/api/v1/trip?route=OSW17&direction=WESTBOUND&stop=abc")
    assert bad_stop.status_code == 400 and bad_stop.get_json()["error"]["code"] == "INVALID_STOP"
    no_direction = client.get("/api/v1/trip?route=OSW17&stop=15888")
    assert no_direction.status_code == 400
    assert no_direction.get_json()["error"]["code"] == "MISSING_DIRECTION"


def test_trip_bus_on_other_direction_is_before_start(client, centro):
    live(centro, prediction_body={"prd": []}, vehicles_body={"vehicle": [vehicle("2213", 9775, 6000, tmstmp=stamp())]})
    payload = client.get(URL).get_json()
    assert payload["bus"]["id"] == "2213"
    assert payload["bus"]["listPosition"] == "before_start"


def test_trip_last_stop_says_times_are_not_posted(client, centro):
    live(centro, prediction_body={"error": [{"msg": "No service scheduled"}]}, vehicle_predictions_body={"prd": []})
    payload = client.get("/api/v1/trip?route=OSW17&direction=WESTBOUND&stop=15521").get_json()
    assert payload["status"] == "beyond_window"
    assert payload["message"] == LAST_STOP_MESSAGE
