from api.src.services.trip import (
    boarding_pattern,
    pick_tracked_bus,
    stop_points,
    stop_timeline,
    stops_away,
    turnaround_confirmed,
)

from .trip_fixtures import (
    BY_PID,
    OSW17_PATTERNS,
    P2722,
    P9757,
    P9768,
    P9775,
    prediction,
    vehicle,
)

BOARDING = "15888"  # E Bridge St & E 1st St, WESTBOUND


def test_stop_points_keep_only_stops_in_order():
    points = stop_points(P9768)
    assert [p["stpid"] for p in points][:3] == ["9614", "15518", "15515"]
    assert all(isinstance(p["pdist"], float) for p in points)


def test_tracks_vehicle_of_earliest_stop_prediction():
    vehicles = [vehicle("2213", 9768, 1000), vehicle("2215", 9768, 6000)]
    predictions = [
        prediction(BOARDING, "WESTBOUND", "9", vid="2213", prdtm="20261024 10:50"),
        prediction(BOARDING, "WESTBOUND", "3", vid="2215", prdtm="20261024 10:44"),
    ]
    assert pick_tracked_bus(BOARDING, "WESTBOUND", predictions, vehicles, BY_PID)["vid"] == "2215"


def test_tracks_predicted_vehicle_even_without_position():
    predictions = [prediction(BOARDING, "WESTBOUND", "5", vid="2299")]
    assert pick_tracked_bus(BOARDING, "WESTBOUND", predictions, [], BY_PID) == {"vid": "2299"}


def test_beyond_window_prefers_same_direction_bus_before_stop():
    vehicles = [vehicle("2213", 9775, 6500), vehicle("2215", 9768, 3000)]
    assert pick_tracked_bus(BOARDING, "WESTBOUND", [], vehicles, BY_PID)["vid"] == "2215"


def test_ignores_same_direction_bus_past_stop():
    vehicles = [vehicle("2215", 9768, 8000), vehicle("2213", 9775, 6500)]
    assert pick_tracked_bus(BOARDING, "WESTBOUND", [], vehicles, BY_PID)["vid"] == "2213"


def test_ignores_bus_on_variant_without_stop():
    vehicles = [vehicle("2215", 9757, 500)]
    assert pick_tracked_bus("15515", "WESTBOUND", [], vehicles, BY_PID) is None


def test_ignores_vehicle_with_unknown_pattern():
    assert pick_tracked_bus(BOARDING, "WESTBOUND", [], [vehicle("2215", 1111, 0)], BY_PID) is None


def test_opposite_direction_least_remaining_distance():
    vehicles = [vehicle("2213", 9775, 3000), vehicle("2214", 9775, 6500)]
    assert pick_tracked_bus(BOARDING, "WESTBOUND", [], vehicles, BY_PID)["vid"] == "2214"


def test_boarding_pattern_is_bus_pattern_when_it_serves_the_stop():
    bus = vehicle("2215", 9757, 1000)
    assert boarding_pattern(BOARDING, "WESTBOUND", OSW17_PATTERNS, bus, [])["pid"] == 9757


def test_boarding_pattern_follows_bus_next_trip_stops():
    bus = vehicle("2213", 9775, 6000)
    predictions = [prediction("15518", "WESTBOUND", "9", tatripid="T2")]
    assert boarding_pattern(BOARDING, "WESTBOUND", OSW17_PATTERNS, bus, predictions)["pid"] == 9768


def test_boarding_pattern_defaults_to_longest_variant():
    assert boarding_pattern(BOARDING, "WESTBOUND", OSW17_PATTERNS, None, [])["pid"] == 9768


def test_turnaround_confirmed_needs_other_trip_in_direction():
    bus = vehicle("2213", 9775, 6000, tatripid="T1")
    assert turnaround_confirmed(bus, "WESTBOUND", [prediction("15888", "WESTBOUND", "20", tatripid="T2")])
    assert not turnaround_confirmed(bus, "WESTBOUND", [prediction("9614", "EASTBOUND", "2", tatripid="T1")])


def test_stops_away_on_same_pattern():
    bus = vehicle("2215", 9768, 2500)
    # George, 13th, 9th, Cayuga, 1st
    assert stops_away(BOARDING, "WESTBOUND", bus, P9768, P9768, []) == 5


def test_bus_at_boarding_stop_is_zero_stops_away():
    bus = vehicle("2215", 9768, 7000)
    assert stops_away(BOARDING, "WESTBOUND", bus, P9768, P9768, []) == 0


def test_stops_away_across_confirmed_turnaround():
    bus = vehicle("2213", 9775, 6000, tatripid="T1")
    predictions = [
        prediction("9614", "EASTBOUND", "2", tatripid="T1"),
        prediction("15518", "WESTBOUND", "9", tatripid="T2"),
    ]
    # Walmart (end of eastbound = start of westbound, counted once), then
    # garage, OCO, George, 13th, 9th, Cayuga, 1st.
    assert stops_away(BOARDING, "WESTBOUND", bus, P9775, P9768, predictions) == 8


def test_stops_away_none_when_turnaround_unconfirmed():
    bus = vehicle("2213", 9775, 6000, tatripid="T1")
    predictions = [prediction("9614", "EASTBOUND", "2", tatripid="T1")]
    assert stops_away(BOARDING, "WESTBOUND", bus, P9775, P9768, predictions) is None


def test_stops_away_none_when_bus_pattern_unknown():
    bus = vehicle("2213", 1111, 6000)
    assert stops_away(BOARDING, "WESTBOUND", bus, None, P9768, []) is None


def test_loop_route_uses_next_occurrence_of_boarding_stop():
    bus = vehicle("2212", 2722, 1500)
    # Penfield, then Campus Center again at the end of the loop.
    assert stops_away("15521", "FROM CAMPUS", bus, P2722, P2722, []) == 2
    stops, _ = stop_timeline("15521", "FROM CAMPUS", bus, P2722, P2722, [])
    assert [s["isBoarding"] for s in stops] == [False, False, False, True]


def test_timeline_marks_passed_and_matches_direction():
    bus = vehicle("2215", 9768, 4500, tatripid="T2")
    predictions = [
        prediction("15880", "WESTBOUND", "DUE", vid="2215", tatripid="T2"),
        prediction("18253", "EASTBOUND", "40", vid="2215", tatripid="T3", prdtm="20261024 11:25"),
        prediction("18253", "WESTBOUND", "3", vid="2215", tatripid="T2", prdtm="20261024 10:48"),
        prediction(BOARDING, "WESTBOUND", "4", vid="2215", tatripid="T2", prdtm="20261024 10:49"),
    ]
    stops, bus_after = stop_timeline(BOARDING, "WESTBOUND", bus, P9768, P9768, predictions)
    by_id = {s["id"]: s for s in stops}
    assert [s["state"] for s in stops[:5]] == ["passed"] * 5
    assert by_id["15880"]["state"] == "upcoming"
    assert by_id["15880"]["minutes"] == 0 and by_id["15880"]["due"] is True
    assert by_id["18253"]["minutes"] == 3
    assert by_id[BOARDING]["isBoarding"] is True and by_id[BOARDING]["minutes"] == 4
    assert by_id[BOARDING]["name"] == "E Bridge St & E 1st St"
    assert sum(s["isBoarding"] for s in stops) == 1
    assert bus_after == "15873"


def test_timeline_unpredicted_stop_has_no_time():
    bus = vehicle("2215", 9768, 4500)
    stops, _ = stop_timeline(BOARDING, "WESTBOUND", bus, P9768, P9768, [])
    upcoming = [s for s in stops if s["state"] == "upcoming"]
    assert upcoming and all(s["minutes"] is None and s["due"] is False for s in upcoming)


def test_timeline_bus_on_other_direction():
    bus = vehicle("2213", 9775, 6000)
    stops, bus_after = stop_timeline(BOARDING, "WESTBOUND", bus, P9775, P9768, [])
    assert all(s["state"] == "upcoming" for s in stops)
    assert bus_after is None


def test_timeline_without_bus_lists_pattern_in_order():
    stops, bus_after = stop_timeline(BOARDING, "WESTBOUND", None, None, P9757, [])
    assert [s["id"] for s in stops][0] == "9614"
    assert len(stops) == 9 and bus_after is None
