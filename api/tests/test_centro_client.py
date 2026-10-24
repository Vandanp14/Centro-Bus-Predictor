from datetime import datetime, timedelta, timezone

from api.src import arrival_status
from api.src.services.centro_client import CentroClient


class _Response:
    def __init__(self, body):
        self._body = body

    def raise_for_status(self):
        return None

    def json(self):
        return {"bustime-response": self._body}


class StubSession:
    def __init__(self, body=None):
        self.body = body or {}
        self.calls = []

    def get(self, url, params=None, timeout=None):
        self.calls.append((url, dict(params or {})))
        return _Response(self.body)


def make_client(body=None):
    session = StubSession(body)
    return CentroClient("test-key", session=session), session


def test_predictions_for_vehicle_uses_vid():
    client, session = make_client({"prd": []})
    client.predictions_for_vehicle("2213")
    url, params = session.calls[0]
    assert url.endswith("/getpredictions")
    assert params["vid"] == "2213"
    assert "rt" not in params and "stpid" not in params


def test_pattern_uses_pid():
    client, session = make_client({"ptr": []})
    client.pattern("9768")
    url, params = session.calls[0]
    assert url.endswith("/getpatterns")
    assert params["pid"] == "9768"


def test_vehicles_cache_is_15_seconds():
    client, session = make_client({"vehicle": []})
    client.vehicles("OSW17")
    client.vehicles("OSW17")
    assert len(session.calls) == 1

    (entry,) = client._cache.values()
    assert entry.expires_at - datetime.now(timezone.utc) <= timedelta(seconds=15)

    entry.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    client.vehicles("OSW17")
    assert len(session.calls) == 2


def test_route_patterns_cache_is_5_minutes():
    # getpatterns only lists currently-active patterns, so a direction that
    # becomes active must show up within minutes, not an hour.
    client, _ = make_client({"ptr": []})
    client.patterns("OSW17")
    (entry,) = client._cache.values()
    assert entry.expires_at - datetime.now(timezone.utc) <= timedelta(minutes=5)


def test_classify_empty():
    upstream = {"error": [{"msg": "No service scheduled"}]}
    assert arrival_status.classify_empty(2, upstream) == (
        "beyond_window", arrival_status.BEYOND_WINDOW_MESSAGE,
    )
    assert arrival_status.classify_empty(0, upstream) == (
        "no_service", arrival_status.NO_SERVICE_MESSAGE,
    )
    assert arrival_status.classify_empty(None, upstream) == ("unknown", "No service scheduled")


def test_count_vehicles():
    assert arrival_status.count_vehicles({"vehicle": [{}, {}]}) == 2
    assert arrival_status.count_vehicles({"error": [{"msg": "No data found for parameter"}]}) == 0
    # Any other Centro error (e.g. a rate limit) says nothing about service.
    assert arrival_status.count_vehicles({"error": [{"msg": "Transaction limit for current day has been exceeded."}]}) is None
