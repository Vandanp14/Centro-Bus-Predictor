import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import pytest


class FakeCentroClient:
    configured = True

    def __init__(self):
        self.vehicles_body = {
            "vehicle": [{"vid": "2212", "tmstmp": "20260725 20:10", "lat": "43.453952", "lon": "-76.540263", "hdg": "262", "des": "Campus loop", "rtdir": "FROM CAMPUS", "dly": False}]
        }
        self.stops_body = {
            "stops": [{"stpid": "15521", "stpnm": "SUNY OSWEGO CAMPUS CENTER", "lat": 43.453952, "lon": -76.540263}]
        }
        self.patterns_body = {
            "ptr": [{"pid": 2722, "ln": 10358.0, "rtdir": "FROM CAMPUS", "pt": [{"seq": 1, "lat": 43.453952, "lon": -76.540263, "typ": "S", "stpid": "15521", "stpnm": "SUNY OSWEGO CAMPUS CENTER"}, {"seq": 2, "lat": 43.454, "lon": -76.54, "typ": "W"}]}]
        }
        self.patterns_error = None
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
                {"rt": "OSW10", "rtnm": "SUNY Oswego Blue Route", "rtclr": "#99ccff"},
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
        return self.stops_body

    def predictions(self, route_id, stop_id, direction=None):
        return self.prediction_body

    def vehicles(self, route_id):
        return self.vehicles_body

    def patterns(self, route_id):
        if self.patterns_error:
            raise self.patterns_error
        return self.patterns_body


@pytest.fixture
def centro():
    return FakeCentroClient()


@pytest.fixture
def client(centro, monkeypatch):
    from api.src.app import create_app
    flask_app = create_app(testing=True)
    flask_app.config["CENTRO_CLIENT"] = centro
    return flask_app.test_client()
