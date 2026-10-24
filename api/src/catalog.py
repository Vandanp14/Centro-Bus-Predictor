OSWEGO_ROUTE_IDS = (
    "OSW09", "OSW10", "OSW11", "OSW17", "OSW18", "OSW19", "OSW46",
    "MEX16", "FUL14", "FUL15", "SY46",
)

ROUTE_METADATA = {
    "OSW09": {
        "shortName": "09",
        "fallbackName": "Price Chopper Shopper",
        "color": "#F2A65A",
        "category": "Shopper service",
        "scheduleUrl": "https://www.centro.org/Route-Time-Tables/osw-9",
    },
    "OSW10": {
        "shortName": "10",
        "fallbackName": "SUNY Oswego Blue Route",
        "color": "#78C7F0",
        "category": "SUNY Oswego campus",
        "scheduleUrl": "https://www.centro.org/Route-Time-Tables/osw-10",
    },
    "OSW11": {
        "shortName": "11",
        "fallbackName": "SUNY Oswego Green Route",
        "color": "#70C99A",
        "category": "SUNY Oswego campus",
        "scheduleUrl": "https://www.centro.org/Route-Time-Tables/osw-11",
    },
    "OSW17": {
        "shortName": "17",
        "fallbackName": "Bridge Street",
        "color": "#EC7B68",
        "category": "Oswego city",
        "scheduleUrl": "https://www.centro.org/Route-Time-Tables/osw-17",
    },
    "OSW18": {
        "shortName": "18",
        "fallbackName": "Sunrise West",
        "color": "#E8C45B",
        "category": "Oswego city",
        "scheduleUrl": "https://www.centro.org/Route-Time-Tables/osw-18",
    },
    "OSW19": {
        "shortName": "19",
        "fallbackName": "Brandonwood East",
        "color": "#B89BE8",
        "category": "Oswego city",
        "scheduleUrl": "https://www.centro.org/Route-Time-Tables/osw-19",
    },
    "OSW46": {
        "shortName": "46",
        "fallbackName": "Oswego – Syracuse",
        "color": "#D98963",
        "category": "Regional service",
        "scheduleUrl": "https://www.centro.org/Route-Time-Tables/osw-46",
    },
    "MEX16": {
        "shortName": "16",
        "fallbackName": "Mexico – Fulton",
        "color": "#8FB8DE",
        "category": "Oswego County",
        "scheduleUrl": "https://www.centro.org/Route-Time-Tables/mex-3",
    },
    "FUL14": {
        "shortName": "14",
        "fallbackName": "Fulton – East",
        "color": "#9CC9A8",
        "category": "Fulton",
        "scheduleUrl": "https://www.centro.org/Route-Time-Tables/ful-4",
    },
    "FUL15": {
        "shortName": "15",
        "fallbackName": "Fulton – West",
        "color": "#D4A5C9",
        "category": "Fulton",
        "scheduleUrl": "https://www.centro.org/Route-Time-Tables/ful-5",
    },
    "SY46": {
        "shortName": "SY46",
        "fallbackName": "Liverpool – Route 57",
        "color": "#CC9999",
        "category": "Syracuse connection",
        "scheduleUrl": "https://www.centro.org/Route-Time-Tables/sy-46",
    },
}


def catalog_routes():
    return [
        {"id": route_id, "name": ROUTE_METADATA[route_id]["fallbackName"], **ROUTE_METADATA[route_id]}
        for route_id in OSWEGO_ROUTE_IDS
    ]
