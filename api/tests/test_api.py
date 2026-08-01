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
        assert len(payload["routes"]) == 7
        assert payload["routes"][1]["id"] == "OSW10"
        assert payload["routes"][1]["name"] == "SUNY Oswego Blue Route"

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

    def test_no_service_is_empty_state(self, client, centro):
        centro.prediction_body = {"error": [{"msg": "No service scheduled", "rt": "OSW10"}]}
        response = client.get("/api/v1/predictions?route=OSW10&stop=15521")
        assert response.status_code == 200
        payload = response.get_json()
        assert payload["predictions"] == []
        assert payload["message"] == "No service scheduled"


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
