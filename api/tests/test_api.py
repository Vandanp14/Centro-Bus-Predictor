import pytest
from datetime import timezone


class TestHealth:
    def test_health_reports_configuration(self, client, centro):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.get_json()["configured"] is True


class TestRoutes:
    def test_routes_are_current_oswego_catalog(self, client):
        response = client.get("/api/v1/routes")
        assert response.status_code == 200
        payload = response.get_json()
        assert len(payload["routes"]) == 11
        assert payload["routes"][1]["id"] == "OSW10"
        assert payload["routes"][1]["name"] == "SUNY Oswego Blue Route"

    def test_routes_include_student_connections(self, client):
        ids = [route["id"] for route in client.get("/api/v1/routes").get_json()["routes"]]
        assert ids[-4:] == ["MEX16", "FUL14", "FUL15", "SY46"]

    def test_connection_routes_are_supported(self, client):
        response = client.get("/api/v1/routes/MEX16/directions")
        assert response.status_code == 200

    def test_directions(self, client):
        response = client.get("/api/v1/routes/OSW10/directions")
        assert response.status_code == 200
        assert response.get_json()["directions"][0]["id"] == "FROM CAMPUS"

    def test_directions_unknown_route(self, client):
        response = client.get("/api/v1/routes/OSW1A/directions")
        assert response.status_code == 404
        assert response.get_json()["error"]["code"] == "UNKNOWN_ROUTE"
        assert "requestId" in response.get_json()["error"]

    def test_stops(self, client):
        response = client.get("/api/v1/routes/OSW10/stops?direction=FROM%20CAMPUS")
        assert response.status_code == 200
        assert response.get_json()["stops"][0]["id"] == "15521"
        assert isinstance(response.get_json()["stops"][0]["lat"], float)

    def test_stops_follow_route_sequence(self, client, centro):
        centro.stops_body = {"stops": [
            {"stpid": "1", "stpnm": "Alpha"},
            {"stpid": "2", "stpnm": "Bravo"},
            {"stpid": "3", "stpnm": "Charlie"},
        ]}
        centro.patterns_body = {"ptr": [
            {"pid": 1, "rtdir": "FROM CAMPUS", "pt": [
                {"seq": 2, "lat": 1, "lon": 1, "typ": "S", "stpid": "1"},
                {"seq": 1, "lat": 1, "lon": 1, "typ": "S", "stpid": "3"},
            ]},
            {"pid": 2, "rtdir": "TO CAMPUS", "pt": [
                {"seq": 1, "lat": 1, "lon": 1, "typ": "S", "stpid": "2"},
            ]},
        ]}
        payload = client.get("/api/v1/routes/OSW10/stops?direction=FROM%20CAMPUS").get_json()
        assert [stop["id"] for stop in payload["stops"]] == ["3", "1", "2"]
        assert payload["stopOrder"] == "route"

    def test_stop_order_uses_pattern_seen_earlier(self, client, centro):
        centro.stops_body = {"stops": [
            {"stpid": "1", "stpnm": "Alpha"},
            {"stpid": "2", "stpnm": "Bravo"},
        ]}
        centro.patterns_body = {"ptr": [{"pid": 1, "rtdir": "FROM CAMPUS", "pt": [
            {"seq": 1, "lat": 1, "lon": 1, "typ": "S", "stpid": "2"},
            {"seq": 2, "lat": 1, "lon": 1, "typ": "S", "stpid": "1"},
        ]}]}
        client.get("/api/v1/routes/OSW10/stops?direction=FROM%20CAMPUS")
        centro.patterns_body = {"ptr": []}
        payload = client.get("/api/v1/routes/OSW10/stops?direction=FROM%20CAMPUS").get_json()
        assert payload["stopOrder"] == "route"
        assert [stop["id"] for stop in payload["stops"]] == ["2", "1"]

    def test_stops_keep_upstream_order_without_pattern(self, client, centro):
        centro.stops_body = {"stops": [
            {"stpid": "1", "stpnm": "Alpha"},
            {"stpid": "2", "stpnm": "Bravo"},
        ]}
        centro.patterns_body = {"ptr": []}
        payload = client.get("/api/v1/routes/OSW10/stops?direction=TO%20CAMPUS").get_json()
        assert [stop["id"] for stop in payload["stops"]] == ["1", "2"]
        assert payload["stopOrder"] == "alphabetical"

    def test_stops_survive_pattern_failure(self, client, centro):
        from api.src.services.centro_client import CentroAPIError
        centro.patterns_error = CentroAPIError("down")
        response = client.get("/api/v1/routes/OSW10/stops?direction=FROM%20CAMPUS")
        assert response.status_code == 200
        assert response.get_json()["stops"][0]["id"] == "15521"
        assert response.get_json()["stopOrder"] == "alphabetical"

    def test_stops_missing_direction(self, client):
        response = client.get("/api/v1/routes/OSW10/stops")
        assert response.status_code == 400
        assert response.get_json()["error"]["code"] == "MISSING_DIRECTION"


class TestPredictions:
    def test_predictions_normalize_due_and_delayed(self, client):
        response = client.get("/api/v1/predictions?route=OSW10&stop=15521&direction=FROM%20CAMPUS")
        assert response.status_code == 200
        payload = response.get_json()
        assert len(payload["predictions"]) == 2
        assert payload["predictions"][0]["due"] is True
        assert payload["predictions"][0]["minutes"] == 0
        assert payload["predictions"][1]["delayed"] is True
        assert payload["status"] == "live"

    def test_bus_beyond_prediction_window_is_not_no_service(self, client, centro):
        # Centro answers "No service scheduled" both when no bus runs and when
        # the bus is more than ~45 minutes away; live vehicles tell them apart.
        centro.prediction_body = {"error": [{"msg": "No service scheduled", "rt": "OSW10"}]}
        response = client.get("/api/v1/predictions?route=OSW10&stop=15521")
        assert response.status_code == 200
        payload = response.get_json()
        assert payload["predictions"] == []
        assert payload["status"] == "beyond_window"
        assert payload["activeVehicles"] == 1
        assert "45 minutes" in payload["message"]

    def test_no_bus_on_route_is_no_service(self, client, centro):
        centro.prediction_body = {"error": [{"msg": "No service scheduled", "rt": "OSW10"}]}
        centro.vehicles_body = {"error": [{"rt": "OSW10", "msg": "No data found for parameter"}]}
        payload = client.get("/api/v1/predictions?route=OSW10&stop=15521").get_json()
        assert payload["status"] == "no_service"
        assert payload["activeVehicles"] == 0
        assert payload["message"] == "No bus is running on this route right now."


    def test_vehicle_error_is_not_no_service(self, client, centro):
        centro.prediction_body = {"error": [{"msg": "No service scheduled", "rt": "OSW10"}]}
        centro.vehicles_body = {"error": [{"rt": "OSW10", "msg": "Transaction limit for current day has been exceeded."}]}
        payload = client.get("/api/v1/predictions?route=OSW10&stop=15521").get_json()
        assert payload["status"] == "unknown"
        assert payload["activeVehicles"] is None


class TestVehicles:
    def test_vehicle_payload(self, client):
        response = client.get("/api/v1/routes/OSW10/vehicles").get_json()
        assert response["vehicles"][0]["id"] == "2212"
        assert response["vehicles"][0]["heading"] == 262

    def test_all_vehicles(self, client):
        response = client.get("/api/v1/vehicles").get_json()
        assert isinstance(response["vehicles"], list)
        assert "total" in response


class TestPatterns:
    def test_pattern_payload(self, client):
        response = client.get("/api/v1/routes/OSW10/patterns?direction=FROM%20CAMPUS").get_json()
        assert len(response["patterns"]) == 1
        assert response["patterns"][0]["points"][0]["stopId"] == "15521"

    def test_patterns_unknown_route(self, client):
        response = client.get("/api/v1/routes/OSW1A/patterns")
        assert response.status_code == 404
