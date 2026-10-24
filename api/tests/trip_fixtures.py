"""OSW17-shaped Centro fixtures.

Stop ids and names are real (docs/centro-routes.json, 2026-10-24); pdist
values are simplified to round numbers so expected counts are easy to read.
"""

WEST_WITH_GARAGE = [  # pattern 9768 — the WESTBOUND variant via garage + OCO
    ("9614", "Walmart - Oswego", 0),
    ("15518", "CENTRO GARAGE OSWEGO", 1000),
    ("15515", "OCO MEDICAL CENTER", 2000),
    ("17808", "Route 104 & George St", 3000),
    ("15873", "Rte 104 & E 13th St", 4000),
    ("15880", "E Bridge St & E 9th St", 5000),
    ("18253", "E Cayuga St & E 3rd St", 6000),
    ("15888", "E Bridge St & E 1st St", 7000),
    ("3579", "W Bridge St & W 2nd St", 8000),
    ("16019", "Washington Blvd & Baylis St", 9000),
    ("15521", "SUNY OSWEGO CAMPUS CENTER", 10000),
]

WEST_DIRECT = [  # pattern 9757 — skips garage and OCO
    ("9614", "Walmart - Oswego", 0),
    ("17808", "Route 104 & George St", 1000),
    ("15873", "Rte 104 & E 13th St", 2000),
    ("15880", "E Bridge St & E 9th St", 3000),
    ("18253", "E Cayuga St & E 3rd St", 4000),
    ("15888", "E Bridge St & E 1st St", 5000),
    ("3579", "W Bridge St & W 2nd St", 6000),
    ("16019", "Washington Blvd & Baylis St", 7000),
    ("15521", "SUNY OSWEGO CAMPUS CENTER", 8000),
]

EAST = [  # pattern 9775
    ("15521", "SUNY OSWEGO CAMPUS CENTER", 0),
    ("9679", "Washington Blvd & Baylis St", 1000),
    ("3581", "W Bridge St & W 2nd St", 2000),
    ("18253", "E Cayuga St & E 3rd St", 3000),
    ("9729", "E Bridge St & E 9th St", 4000),
    ("9736", "Route 104 & E 13th St", 5000),
    ("9737", "Route 104 & George St", 6000),
    ("9614", "Walmart - Oswego", 7000),
]

CAMPUS_LOOP = [  # synthetic loop that starts and ends at Campus Center
    ("15521", "SUNY OSWEGO CAMPUS CENTER", 0),
    ("9679", "Washington Blvd & Baylis St", 1000),
    ("16170", "PENFIELD LIBRARY", 2000),
    ("15521", "SUNY OSWEGO CAMPUS CENTER", 3000),
]


def pattern(pid, direction, stops):
    points = []
    for index, (stop_id, name, pdist) in enumerate(stops):
        points.append({
            "seq": index * 2 + 1, "typ": "S", "stpid": stop_id, "stpnm": name,
            "pdist": float(pdist), "lat": 43.45 + index / 1000, "lon": -76.5 - index / 1000,
        })
        points.append({
            "seq": index * 2 + 2, "typ": "W", "pdist": float(pdist) + 1,
            "lat": 43.45 + index / 1000, "lon": -76.5,
        })
    return {"pid": pid, "rtdir": direction, "ln": float(stops[-1][2]), "pt": points}


P9768 = pattern(9768, "WESTBOUND", WEST_WITH_GARAGE)
P9757 = pattern(9757, "WESTBOUND", WEST_DIRECT)
P9775 = pattern(9775, "EASTBOUND", EAST)
P2722 = pattern(2722, "FROM CAMPUS", CAMPUS_LOOP)
OSW17_PATTERNS = [P9768, P9757, P9775]
BY_PID = {str(p["pid"]): p for p in OSW17_PATTERNS + [P2722]}


def vehicle(vid, pid, pdist, tatripid="T1", **extra):
    return {
        "vid": vid, "pid": pid, "pdist": pdist, "tatripid": tatripid,
        "des": "17 Bridge St", "dly": False, "lat": "43.46", "lon": "-76.51",
        "hdg": "90", "tmstmp": "20261024 10:40", **extra,
    }


def prediction(stop_id, direction, countdown, vid="2213", tatripid="T1", prdtm="20261024 10:45"):
    return {
        "stpid": stop_id, "rtdir": direction, "prdctdn": countdown, "vid": vid,
        "tatripid": tatripid, "prdtm": prdtm, "tmstmp": "20261024 10:40", "dly": False,
    }
