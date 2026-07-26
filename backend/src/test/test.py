import os
import sys
import unittest


sys.path.insert(
    0,
    os.path.join(os.path.dirname(__file__), "..", "main"),
)

from app import create_app


class FakeCentroClient:
    configured = True

    def __init__(self):
        self.prediction_body = {
            "prd": [
                {
                    "tmstmp": "20260725 20:10",
                    "stpnm": "SUNY OSWEGO CAMPUS CENTER",
                    "stpid": "15521",
                    "vid": "2212",
                    "rt": "OSW10",
                    "rtdir": "FROM CAMPUS",
                    "des": "Campus loop",
                    "prdtm": "20260725 20:11",
                    "dly": False,
                    "prdctdn": "DUE",
                    "typ": "A",
                },
                {
                    "tmstmp": "20260725 20:10",
                    "stpnm": "SUNY OSWEGO CAMPUS CENTER",
                    "stpid": "15521",
                    "vid": "2213",
                    "rt": "OSW10",
                    "rtdir": "FROM CAMPUS",
                    "des": "Campus loop",
                    "prdtm": "20260725 20:19",
                    "dly": True,
                    "prdctdn": "9",
                    "typ": "A",
                },
            ]
        }

    def routes(self):
        return {
            "routes": [
                {
                    "rt": "OSW10",
                    "rtnm": "SUNY Oswego Blue Route",
                    "rtclr": "#99ccff",
                },
                {"rt": "SY10", "rtnm": "Not in Oswego", "rtclr": "#000000"},
            ]
        }

    def directions(self, route_id):
        return {
            "directions": [
                {"id": "FROM CAMPUS", "name": "FROM CAMPUS"},
                {"id": "TO CAMPUS", "name": "TO CAMPUS"},
            ]
        }

    def stops(self, route_id, direction):
        return {
            "stops": [
                {
                    "stpid": "15521",
                    "stpnm": "SUNY OSWEGO CAMPUS CENTER",
                    "lat": 43.453952,
                    "lon": -76.540263,
                }
            ]
        }

    def predictions(self, route_id, stop_id, direction=None):
        return self.prediction_body

    def vehicles(self, route_id):
        return {
            "vehicle": [
                {
                    "vid": "2212",
                    "tmstmp": "20260725 20:10",
                    "lat": "43.453952",
                    "lon": "-76.540263",
                    "hdg": "262",
                    "des": "Campus loop",
                    "rtdir": "FROM CAMPUS",
                    "dly": False,
                }
            ]
        }

    def patterns(self, route_id):
        return {
            "ptr": [
                {
                    "pid": 2722,
                    "ln": 10358.0,
                    "rtdir": "FROM CAMPUS",
                    "pt": [
                        {
                            "seq": 1,
                            "lat": 43.453952,
                            "lon": -76.540263,
                            "typ": "S",
                            "stpid": "15521",
                            "stpnm": "SUNY OSWEGO CAMPUS CENTER",
                        },
                        {
                            "seq": 2,
                            "lat": 43.454,
                            "lon": -76.54,
                            "typ": "W",
                        },
                    ],
                }
            ]
        }


class TestAPIEndpoints(unittest.TestCase):
    def setUp(self):
        self.centro = FakeCentroClient()
        flask_app = create_app(centro_client=self.centro, testing=True)
        self.client = flask_app.test_client()

    def test_health_reports_configuration(self):
        response = self.client.get("/api/v1/health")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["configured"])

    def test_routes_are_current_oswego_catalog(self):
        response = self.client.get("/api/v1/routes")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(len(payload["routes"]), 7)
        self.assertEqual(payload["routes"][1]["id"], "OSW10")
        self.assertEqual(payload["routes"][1]["name"], "SUNY Oswego Blue Route")
        self.assertNotIn("OSW1A", [route["id"] for route in payload["routes"]])

    def test_directions_and_stops_use_bustime_shapes(self):
        directions = self.client.get("/api/v1/routes/OSW10/directions")
        self.assertEqual(directions.status_code, 200)
        self.assertEqual(
            directions.get_json()["directions"][0]["id"],
            "FROM CAMPUS",
        )

        stops = self.client.get(
            "/api/v1/routes/OSW10/stops?direction=FROM%20CAMPUS"
        )
        self.assertEqual(stops.status_code, 200)
        self.assertEqual(stops.get_json()["stops"][0]["id"], "15521")
        self.assertIsInstance(stops.get_json()["stops"][0]["lat"], float)

    def test_predictions_normalize_due_and_multiple_buses(self):
        response = self.client.get(
            "/api/v1/predictions"
            "?route=OSW10&stop=15521&direction=FROM%20CAMPUS"
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(len(payload["predictions"]), 2)
        self.assertTrue(payload["predictions"][0]["due"])
        self.assertEqual(payload["predictions"][0]["minutes"], 0)
        self.assertTrue(payload["predictions"][1]["delayed"])
        self.assertIn("-04:00", payload["predictions"][0]["predictedAt"])

    def test_no_service_is_a_successful_empty_state(self):
        self.centro.prediction_body = {
            "error": [{"msg": "No service scheduled", "rt": "OSW10"}]
        }
        response = self.client.get(
            "/api/v1/predictions?route=OSW10&stop=15521"
        )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["predictions"], [])
        self.assertEqual(payload["message"], "No service scheduled")

    def test_vehicle_and_pattern_payloads_are_map_ready(self):
        vehicles = self.client.get("/api/v1/routes/OSW10/vehicles").get_json()
        self.assertEqual(vehicles["vehicles"][0]["id"], "2212")
        self.assertEqual(vehicles["vehicles"][0]["heading"], 262)

        patterns = self.client.get(
            "/api/v1/routes/OSW10/patterns?direction=FROM%20CAMPUS"
        ).get_json()
        self.assertEqual(len(patterns["patterns"]), 1)
        self.assertEqual(patterns["patterns"][0]["points"][0]["stopId"], "15521")

    def test_validation_uses_stable_error_shape(self):
        response = self.client.get("/api/v1/routes/OSW1A/directions")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json()["error"]["code"], "UNKNOWN_ROUTE")
        self.assertIn("requestId", response.get_json()["error"])


if __name__ == "__main__":
    unittest.main()
