import json

from api.src.services.centro_client import CentroAPIError
from api.src.services.pattern_store import PatternStore, get_store, pattern_by_id, refresh


def _pattern(pid, direction, ln=1000.0):
    return {"pid": pid, "rtdir": direction, "ln": ln, "pt": [
        {"seq": 1, "typ": "S", "stpid": "1", "pdist": 0.0, "lat": 43.0, "lon": -76.0},
    ]}


def test_remember_merges_directions():
    store = PatternStore()
    store.remember("OSW17", [_pattern(9775, "EASTBOUND")])
    store.remember("OSW17", [_pattern(9757, "WESTBOUND")])
    assert sorted(str(p["pid"]) for p in store.for_route("OSW17")) == ["9757", "9775"]


def test_same_pid_is_replaced():
    store = PatternStore()
    store.remember("OSW17", [_pattern(9775, "EASTBOUND")])
    store.remember("OSW17", [_pattern(9775, "EASTBOUND", ln=1)])
    patterns = store.for_route("OSW17")
    assert len(patterns) == 1
    assert patterns[0]["ln"] == 1


def test_seed_from_reference(tmp_path):
    reference = tmp_path / "centro-routes.json"
    reference.write_text(json.dumps({"routes": [
        {"id": "OSW17", "patterns": [_pattern(9757, "WESTBOUND"), _pattern(9775, "EASTBOUND")]},
        {"id": "SY10", "patterns": None},
    ]}), encoding="utf-8")
    store = PatternStore()
    assert store.seed_from_reference(reference) == 2
    assert store.get("9757") is not None
    assert PatternStore().seed_from_reference(tmp_path / "missing.json") == 0


def test_refresh_survives_centro_error(centro):
    centro.patterns_body = {"ptr": [_pattern(2722, "FROM CAMPUS")]}
    refresh(centro, "OSW10")
    centro.patterns_error = CentroAPIError("down")
    assert [str(p["pid"]) for p in refresh(centro, "OSW10")] == ["2722"]


def test_pattern_by_id_fetches_missing(centro):
    centro.pattern_bodies = {"9768": {"ptr": [_pattern(9768, "WESTBOUND")]}}
    assert pattern_by_id(centro, "OSW17", "9768")["pid"] == 9768
    assert ("pattern", ("9768",)) in centro.calls
    centro.calls.clear()
    assert pattern_by_id(centro, "OSW17", "9768")["pid"] == 9768
    assert centro.calls == []
    assert get_store().get("9768") is not None
