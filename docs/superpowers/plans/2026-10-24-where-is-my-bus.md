# Where's My Bus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a SUNY Oswego student picks a route, direction and stop, show a map-first screen with a bottom sheet that answers how long, how many stops away, and where the bus is, plus the route's stops in riding order with the next time at each.

**Architecture:** A new Flask endpoint `GET /api/v1/trip` in `api/` combines Centro stop predictions, the tracked bus's own predictions, live vehicles, and a merged per-route pattern store into one payload. Pure functions in `api/src/services/trip.py` do the bus choice, stops-away and timeline math. The React arrivals page (`RouteDetail`) renders `TripMap` + `TripSheet` from that payload. Production is switched from the legacy `backend/` server to `api/` first, so the work actually ships.

**Tech Stack:** Python 3.11 + Flask 3 + pytest (`api/`); React 18 (CRA, `react-scripts`), react-leaflet 4, Jest + Testing Library (`src/`).

**Spec:** `docs/superpowers/specs/2026-10-24-where-is-my-bus-design.md`

## Global Constraints

- Centro BusTime v3 only (`https://bus-time.centro.org/bustime/api/v3`); the API key never leaves the server and never appears in committed files.
- Never invent a time or stop count. Unknown → `null` in the API, "no time yet" / hidden count in the UI.
- Empty-state copy (exact): `beyond_window` title "Bus on the route, no time yet"; `no_service` title "No bus running right now"; messages are `BEYOND_WINDOW_MESSAGE` / `NO_SERVICE_MESSAGE` from today's `api/src/routes/predictions.py`.
- Stops-away across a turnaround only when the bus's own predictions continue into a trip in the student's direction.
- `pdist` is compared only within one pattern; a bus counts for this trip only if its own `pid` contains the boarding stop.
- Refresh every 30 s while `document.visibilityState === 'visible'`; vehicles cached 15 s server-side.
- Light theme tokens from `src/styles/tokens.css`; tabular numerals for times/counts; `prefers-reduced-motion` respected (global rule in `src/index.css` already shortens transitions — don't fight it).
- Desktop breakpoint is the existing `56rem` (`@media (max-width: 55.999rem)` = mobile).
- Run backend tests from repo root: `python3 -m pytest -q api/tests`. Frontend: `CI=true npx react-scripts test --watchAll=false`.
- Commit messages end with `Claude-Session: https://claude.ai/code/session_012WSq9riqd787i2Wpg6w1ZT`. Never push; never run `deploy.sh`.

## Review Focus

1. **Loop routes where the boarding stop is both first and last** (OSW10/OSW11 start and end at SUNY Oswego Campus Center): use the occurrence after the bus's `pdist`, not the first one. Test in Task 4.
2. **Bus sitting at the boarding stop** (`pdist` equal to the stop's `pdist`, e.g. layover at a terminal): 0 stops away, not "passed". Test in Task 4.
3. **Stop prediction names a vehicle missing from `getvehicles`** (no position): countdown still shows, no marker, `bus.lat` null. Test in Task 5.
4. **Student changes stop while a trip request is in flight**: the stale response must not render for the new stop. Test in Task 8.
5. **Stale vehicle feed** (newest `tmstmp` older than 3 minutes): `meta.stale` true and the sheet says "Stale Centro update". Tests in Task 5 and Task 6.

---

### Task 1: Make `api/` the production server

**Files:**
- Modify: `api/src/config.py` (`PROJECT_ROOT`, `load_local_environment`)
- Modify: `api/src/wsgi.py`
- Modify: `deploy.sh` (tarball contents), `deploy-server.sh` (install + start + stop)
- Modify: `README.md` (Deploying section: production runs `api/`)
- Test: `api/tests/test_config.py`

**Interfaces:**
- Produces: `PROJECT_ROOT` = repo root; `BUILD_DIR` = `<repo>/build`; `load_local_environment()` reads `api/.env` then `backend/.env`, process env wins; server starts with `python3 -m api.src.app` from the repo root.

- [ ] **Step 1: Write failing tests** in `api/tests/test_config.py`:
  - `test_project_root_is_repo_root`: `(config.PROJECT_ROOT / "api" / "src" / "config.py").is_file()` and `config.BUILD_DIR == config.PROJECT_ROOT / "build"`.
  - `test_env_falls_back_to_backend_env(tmp_path, monkeypatch)`: write `tmp_path/backend/.env` with `CENTRO_API_KEY=abc`, monkeypatch `config.PROJECT_ROOT` to `tmp_path`, `monkeypatch.delenv("CENTRO_API_KEY", raising=False)`, call `load_local_environment()`, assert `os.environ["CENTRO_API_KEY"] == "abc"`.
  - `test_api_env_wins_over_backend_env`: both files exist with different values → `api/.env` value.
  - `test_wsgi_imports`: `import api.src.wsgi as w; assert w.app is not None`.
- [ ] **Step 2: Run** `python3 -m pytest -q api/tests/test_config.py` → 4 FAIL.
- [ ] **Step 3: Implement.** `PROJECT_ROOT = Path(__file__).resolve().parents[2]`. `load_local_environment()` iterates `(PROJECT_ROOT/"api"/".env", PROJECT_ROOT/"backend"/".env")` with `os.environ.setdefault` (first file wins because setdefault). It must read `PROJECT_ROOT` at call time (module global), so the monkeypatch works. `wsgi.py`: `from .app import app`.
- [ ] **Step 4: Run** `python3 -m pytest -q api/tests` → all PASS.
- [ ] **Step 5: Update deploy scripts.**
  - `deploy.sh`: add `api/ docs/centro-routes.json` to the `tar czf` list, and add `--exclude='api/.env'` so a local-only file is not shipped. Keep `backend/` in the tarball, because `backend/.env` holds the key on the server.
  - `deploy-server.sh`:
    - install with `pip3 install --user -r api/requirements.txt`;
    - stop with `pkill -f "python3? .*(backend/src/main/app.py|app.py|-m api.src.app)" || true`;
    - start with `cd "$APP_DIR" && nohup python3 -m api.src.app > "$APP_DIR/server.log" 2>&1 &`;
    - keep the health-check block unchanged.
- [ ] **Step 6: Verify locally**:
  - Run `npm run build`, then start the server with `PORT=5055 python3 -m api.src.app &`.
  - `curl -s localhost:5055/api/v1/health` should return `"configured": true`.
  - `curl -s -o /dev/null -w "%{http_code}" localhost:5055/` should print `200`, meaning the SPA is served from `build/`.
  - `curl -s "localhost:5055/api/v1/routes" | python3 -c "import json,sys;print(len(json.load(sys.stdin)['routes']))"` should print `11`.
  - Kill the server.
- [ ] **Step 7: README** — in "Deploying", state that `deploy-server.sh` starts `api/` (`python3 -m api.src.app`); `backend/src/main/app.py` is legacy and no longer started.
- [ ] **Step 8: Commit** `api/src/config.py api/src/wsgi.py api/tests/test_config.py deploy.sh deploy-server.sh README.md` — "Run api/ as the production server".

### Task 2: Shared arrival status and new Centro client calls

**Files:**
- Create: `api/src/arrival_status.py`
- Modify: `api/src/routes/predictions.py` (use the shared module)
- Modify: `api/src/services/centro_client.py`
- Modify: `api/tests/conftest.py` (fake client gains the new methods)
- Test: `api/tests/test_centro_client.py`, existing `api/tests/test_api.py`

**Interfaces:**
- Produces:
  - `arrival_status.BEYOND_WINDOW_MESSAGE: str`, `NO_SERVICE_MESSAGE: str` (moved verbatim).
  - `arrival_status.classify_empty(active_vehicles: int | None, upstream_body: dict) -> tuple[str, str]` → `("beyond_window", BEYOND…)` if `active_vehicles` truthy, `("no_service", NO_SERVICE…)` if `== 0`, else `("unknown", first_upstream_message(upstream_body, "No upcoming predictions."))`.
  - `arrival_status.count_vehicles(body: dict) -> int` (len of `vehicle`/`vehicles`).
  - `CentroClient.predictions_for_vehicle(vehicle_id: str) -> dict` → `getpredictions` with `vid=`, `cache_seconds=12`.
  - `CentroClient.pattern(pattern_id: str) -> dict` → `getpatterns` with `pid=`, `cache_seconds=3600`.
  - `CentroClient.vehicles` cache 60 → 15 s.
  - `FakeCentroClient` attributes `vehicle_predictions_body` (default `{"prd": []}`), `pattern_bodies: dict[str, dict]`, and a `calls: list[tuple]` log of `(method, args)`.

- [ ] **Step 1: Write failing tests** `api/tests/test_centro_client.py` using a stub session whose `get(url, params, timeout)` records calls and returns `{"bustime-response": {...}}`:
  - `test_predictions_for_vehicle_uses_vid`: endpoint ends with `/getpredictions`, `params["vid"] == "2213"`, no `rt`/`stpid`.
  - `test_pattern_uses_pid`: endpoint `/getpatterns`, `params["pid"] == "9768"`.
  - `test_vehicles_cache_is_15_seconds`: two calls → one HTTP call; after advancing the cache entry's `expires_at` to the past → second HTTP call. (Inspect `client._cache` entry `expires_at - now` ≤ 15 s.)
  - `test_classify_empty` covers the three branches.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the interfaces above; `predictions.py` imports the messages and `classify_empty`/`count_vehicles` instead of defining them.
- [ ] **Step 4: Run** `python3 -m pytest -q api/tests` → all PASS (existing prediction tests unchanged).
- [ ] **Step 5: Commit** — "Share arrival status; add vehicle-prediction and pattern-by-id calls".

### Task 3: Merged per-route pattern store

**Files:**
- Create: `api/src/services/pattern_store.py`
- Modify: `api/src/app.py` (seed on startup), `api/src/routes/routes.py` (`_order_by_pattern` reads the store), `api/src/routes/patterns.py` (returns merged patterns)
- Modify: `scripts/export_centro_routes.py` (write raw patterns for in-app routes); regenerate `docs/centro-routes.json`, `docs/centro-routes.md`
- Modify: `api/tests/conftest.py` (fresh store per test)
- Test: `api/tests/test_pattern_store.py`, `api/tests/test_api.py`

**Interfaces:**
- Produces (`pattern_store.py`):
  - `class PatternStore` with `remember(route_id: str, patterns: list[dict]) -> None` (raw Centro `ptr` dicts keyed by `str(pid)`; same pid replaced, others kept), `for_route(route_id) -> list[dict]`, `get(pattern_id: str) -> dict | None`, `seed_from_reference(path: Path) -> int` (reads `routes[].patterns` from the export JSON; returns count; missing/invalid file → 0, no raise).
  - `get_store() -> PatternStore` (module singleton, thread-safe with a `Lock`), `reset_store() -> None` (tests).
  - `refresh(client, route_id: str) -> list[dict]`: calls `client.patterns(route_id)`, remembers `ptr`, returns `for_route`; on `CentroAPIError` returns `for_route` without raising.
  - `pattern_by_id(client, route_id: str, pattern_id: str) -> dict | None`: store hit, else `client.pattern(pid)` → remember → return; `CentroAPIError` → `None`.
- Export JSON: each in-app route entry gains `"patterns": [raw ptr dicts with pid, rtdir, ln, pt[seq, typ, stpid, stpnm, pdist, lat, lon]]`, gathered from `getpatterns?rt=` plus `getpatterns?pid=` for every `pid` reported by current vehicles. Non-app routes: `"patterns": null`.

- [ ] **Step 1: Write failing tests** `api/tests/test_pattern_store.py`:
  - `test_remember_merges_directions`: remember `[EAST pid 9775]`, then `[WEST pid 9757]` → `for_route` has both pids.
  - `test_same_pid_is_replaced`: second remember of pid 9775 with `ln=1` → stored `ln == 1`, one entry.
  - `test_seed_from_reference(tmp_path)`: JSON with one route and two patterns → returns 2, `get("9757")` not None; nonexistent path → 0.
  - `test_refresh_survives_centro_error`: fake client raising `CentroAPIError` after one successful call → still returns the earlier patterns.
  - `test_pattern_by_id_fetches_missing` asserts `("pattern", ("9768",))` in `fake.calls` and that a second call does not hit the client.
  - In `test_api.py`: `test_stop_order_uses_pattern_seen_earlier` — first request with patterns for FROM CAMPUS only, then `centro.patterns_body = {"ptr": []}`; second request for FROM CAMPUS stops still returns `stopOrder == "route"`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** store and wire it:
  - `create_app()` calls `get_store().seed_from_reference(PROJECT_ROOT / "docs" / "centro-routes.json")` when not `testing`.
  - `_order_by_pattern` uses `refresh(client, route_id)`.
  - The `patterns` route also uses `refresh`, so the map shows every direction seen.
  - In conftest, an autouse fixture calls `reset_store()`.
- [ ] **Step 4: Update the export script** per the interface. Run `python3 scripts/export_centro_routes.py`. Verify the API key is absent with `grep -c -F "$KEY" docs/centro-routes.*`, which should print `0`. Check that `python3 -c "import json;d=json.load(open('docs/centro-routes.json'));print(sum(len(r['patterns'] or []) for r in d['routes']))"` prints a count of at least 11.
- [ ] **Step 5: Run** `python3 -m pytest -q api/tests` → all PASS.
- [ ] **Step 6: Commit** — "Keep a merged pattern store per route, seeded from the route reference".

### Task 4: Trip math (pure functions)

**Files:**
- Create: `api/src/services/trip.py`
- Create: `api/tests/trip_fixtures.py` (OSW17-shaped builders using real stop ids/names from `docs/centro-routes.json`, simplified `pdist`s)
- Test: `api/tests/test_trip.py`

**Interfaces:**
- Consumes: raw Centro dicts (vehicle: `vid, pid, pdist, tatripid, des, dly, lat, lon, hdg, tmstmp`; prediction: `stpid, rtdir, prdctdn, prdtm, tatripid, vid, dly`; pattern: `pid, rtdir, ln, pt[]`).
- Produces:
  - `stop_points(pattern: dict) -> list[dict]` — `typ == "S"` points sorted by `seq`, each with `stpid: str`, `pdist: float`.
  - `pick_tracked_bus(stop_id: str, direction: str, stop_predictions: list[dict], vehicles: list[dict], patterns_by_pid: dict[str, dict]) -> dict | None`.
    - If stop predictions are present, return the vehicle whose `vid` matches the earliest one.
    - If that vehicle is missing from `vehicles`, return a stub `{"vid": …}` with no position.
    - Otherwise apply the spec's order. A vehicle's direction is `patterns_by_pid[pid]["rtdir"]`, never the vehicle's own field; `rtdir` is absent in v3. A vehicle whose `pid` is unknown is skipped.
  - `boarding_pattern(stop_id: str, direction: str, patterns: list[dict], bus: dict | None, bus_predictions: list[dict]) -> dict | None`.
    - If the bus's own pattern has `rtdir == direction` and contains the stop, use it.
    - Otherwise use the direction variant containing the stop that also contains the `stpid`s of the bus's student-direction predictions.
    - Otherwise use the longest direction variant containing the stop.
  - `turnaround_confirmed(bus: dict, direction: str, bus_predictions: list[dict]) -> bool` — True if any prediction has `rtdir == direction` and a `tatripid` different from the bus's own.
  - `stops_away(stop_id: str, direction: str, bus: dict, bus_pattern: dict | None, board_pattern: dict | None, bus_predictions: list[dict]) -> int | None` — the spec's step 6, with these rules:
    - The boarding stop counts.
    - A stop whose `pdist` equals the bus's `pdist` counts as "not yet passed".
    - The boarding stop's occurrence is the first one with `pdist >= bus pdist` on that pattern.
  - `stop_timeline(stop_id: str, direction: str, bus: dict | None, bus_pattern: dict | None, board_pattern: dict, bus_predictions: list[dict]) -> tuple[list[dict], str | None]`.
    - It returns the list of stop entries plus `busAfterStopId`.
    - Each entry has `id, name, lat, lng, state, minutes, due, predictedAt, isBoarding`.
    - Times are matched on `(stpid, rtdir == direction)`. When several predictions match, take the earliest `prdtm`.
    - `minutes` is parsed like `predictions.py` does (`"DUE"` gives `0` and `due: true`; anything non-numeric gives `None`).

- [ ] **Step 1: Write failing tests** `api/tests/test_trip.py` (fixture: WEST pattern Walmart(0) → George(2847) → E 13th(4058) → … → E Bridge & E 1st(9000, boarding) → … → Campus Center(19036); EAST pattern Campus Center(0) … George(12000) → Walmart(13000); WEST variant 9768 adds CENTRO GARAGE, OCO MEDICAL CENTER; loop pattern for OSW10 starting and ending at 15521):
  - `test_tracks_vehicle_of_earliest_stop_prediction` → returns vid of the `prdctdn "3"` row over `"9"`.
  - `test_beyond_window_prefers_same_direction_bus_before_stop` → WEST bus at pdist 3000 chosen over EAST bus near Walmart.
  - `test_ignores_same_direction_bus_past_stop` → WEST bus at pdist 12000 not chosen; EAST bus chosen.
  - `test_ignores_bus_on_variant_without_stop` → boarding at OCO MEDICAL CENTER, WEST bus on 9757 → `None` when it is the only bus.
  - `test_opposite_direction_least_remaining_distance` → two EAST buses, `ln - pdist` 500 vs 4000 → the 500 one.
  - `test_stops_away_on_same_pattern` → bus pdist 3000, boarding at E Bridge & E 1st → equals the count of WEST stop points with 3000 < pdist ≤ 9000.
  - `test_bus_at_boarding_stop_is_zero_stops_away` → bus pdist 9000 → `0`.
  - `test_stops_away_across_confirmed_turnaround` → EAST bus at George(12000), predictions include a WEST row with another `tatripid` → remaining EAST stops after 12000 + WEST stops up to boarding.
  - `test_stops_away_none_when_turnaround_unconfirmed` → same, no WEST rows → `None`.
  - `test_stops_away_none_when_bus_pattern_unknown` → `bus_pattern=None` → `None`.
  - `test_loop_route_uses_next_occurrence_of_boarding_stop` → OSW10 loop, bus mid-loop, boarding 15521 → counts to the final occurrence, not the first.
  - `test_timeline_marks_passed_and_matches_direction` → same `stpid` in both directions with different times; WEST timeline takes the WEST time; stops with pdist < bus pdist have `state == "passed"`; `busAfterStopId` is the last passed stop id.
  - `test_timeline_unpredicted_stop_has_no_time` → `minutes is None`, `due is False`.
  - `test_timeline_bus_on_other_direction` → no `passed` entries, `busAfterStopId is None`.
- [ ] **Step 2: Run** `python3 -m pytest -q api/tests/test_trip.py` → FAIL.
- [ ] **Step 3: Implement** the interfaces in `api/src/services/trip.py` (no Flask imports; reuse `parse_bustime` from `api/src/utils.py` for `predictedAt`).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — "Add trip math: tracked bus, stops away, ordered timeline".

### Task 5: `GET /api/v1/trip`

**Files:**
- Create: `api/src/routes/trip.py`
- Modify: `api/src/app.py` (register blueprint), `api/tests/conftest.py`
- Test: `api/tests/test_trip_api.py`

**Interfaces:**
- Consumes: Task 2 client methods and `arrival_status`; Task 3 `refresh`, `pattern_by_id`; Task 4 functions.
- Produces: `GET /api/v1/trip?route=&direction=&stop=` with exactly the response shape in the spec ("Response shape"), plus:
  - `bus.minutes`, `due` and `predictedAt` come from the tracked bus's stop prediction. They are `null` when it is beyond the window.
  - `bus.onBoardingDirection` is true when the bus's own pattern `rtdir == direction`.
  - `otherVehicles` lists every positioned vehicle except the tracked one.
  - `pattern` is `{id, points:[{lat,lng}]}` from the boarding pattern, or `null`.
  - `following` holds stop predictions 2..4 as `{minutes, due, predictedAt, vehicleId, destination}`.
  - `meta`: `live`, `stale` (newest vehicle or prediction `tmstmp` older than 3 min), `sourceTime`.
- Errors: unknown route → 404 `UNKNOWN_ROUTE`; non-digit stop → 400 `INVALID_STOP`; missing direction → 400 `MISSING_DIRECTION`. Only a failed stop-predictions call fails the request (handled by the existing `CentroAPIError` handler). Vehicles, bus predictions and patterns failures degrade.

- [ ] **Step 1: Write failing tests** `api/tests/test_trip_api.py` (extend `FakeCentroClient` bodies with the Task 4 fixtures):
  - `test_trip_live_payload` → 200; `status == "live"`; `bus.id`, `bus.minutes == 21`, `bus.stopsAway` int; `stops[*].state` in {passed, upcoming}; exactly one `isBoarding`; `pattern.points` non-empty; `following` length ≤ 3.
  - `test_trip_beyond_window_counts_stops` → no stop predictions, same-direction bus → `status == "beyond_window"`, `bus.minutes is None`, `bus.stopsAway` int, message == `BEYOND_WINDOW_MESSAGE`.
  - `test_trip_no_service` → no vehicles → `status == "no_service"`, `bus is None`, `stops` still listed from the store pattern.
  - `test_trip_fetches_bus_pattern_by_pid` → route patterns lack the bus's pid → `("pattern", ("9768",))` in `centro.calls`.
  - `test_trip_degrades_when_patterns_fail` → `patterns_error` set and no stored patterns → 200, `stops == []`, `bus.stopsAway is None`, `bus.minutes == 21`.
  - `test_trip_degrades_when_bus_predictions_fail` → 200, stop times `None` except those from stop predictions; status still `live`.
  - `test_trip_vehicle_without_position` → stop prediction names vid absent from vehicles → `bus.lat is None`, `bus.minutes` set.
  - `test_trip_stale_feed` → vehicle `tmstmp` 10 minutes old → `meta.stale is True`.
  - `test_trip_validation` → the three error codes above.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the route (reuse `_resolve_client` pattern from sibling routes and `validate_route`, `json_error`, `meta`).
- [ ] **Step 4: Run** `python3 -m pytest -q api/tests` → all PASS.
- [ ] **Step 5: Live check** — start `PORT=5055 python3 -m api.src.app`, pick a route with a reporting bus from `curl -s localhost:5055/api/v1/vehicles`, fetch `/api/v1/trip` for one of its stops, and confirm `status`, `bus.stopsAway` and that `stops` is in riding order (compare with `docs/centro-routes.md`). Kill the server. If no bus is running, record that and rely on tests.
- [ ] **Step 6: Commit** — "Add /api/v1/trip endpoint".

### Task 6: `getTrip` and `TripSheet`

**Files:**
- Modify: `src/services/apiService.js`
- Create: `src/components/TripSheet.js`, `src/components/TripSheet.test.js`
- Create: `src/styles/trip.css`; Modify: `src/App.css` (`@import "./styles/trip.css";` after `arrivals.css`)

**Interfaces:**
- Produces:
  - `getTrip(routeId, stopId, direction, options)` → `request('/trip?' + queryString({route, stop, direction}), options)`.
  - `<TripSheet route trip loading refreshing error expanded onToggle onChangeStop onRefresh />`, where `trip` is the `/trip` payload or `null`.

- [ ] **Step 1: Write failing tests** `TripSheet.test.js`:
  - `collapsed shows countdown, stops away, bus and arrival time` → "21", "min", "12 stops away", "Bus 2213", text matching `/^Arrives /`; `minutes: 1` and `stopsAway: 1` read "1 stop away".
  - `due bus reads Due` → `bus.due: true` → "Due".
  - `toggle exposes the ordered stop list` → button "Show all stops" has `aria-expanded="false"`; with `expanded` the list is an `ol` with one item per stop, the boarding item contains "Your stop", passed items contain visually-hidden "Passed", unpredicted ones show "no time yet".
  - `bus marker row sits after busAfterStopId` → the "Bus 2213 is here" row follows that stop's item; with `busAfterStopId: null` it precedes the first item and includes the destination.
  - `beyond window with count` → title "Bus on the route, no time yet", text "31 stops away · no time yet", link "Check the official schedule" to `route.scheduleUrl`.
  - `beyond window without bus` → same title, no "stops away" text.
  - `no service` → "No bus running right now" and `NO_SERVICE_MESSAGE` text from the payload.
  - `error and loading states` → error → "Live arrivals did not load"; loading → `getByLabelText('Loading live arrivals')`.
  - `stale and delay labels` → `meta.stale` → "Stale Centro update"; `bus.delayed` → "Centro reports a delay".
  - `change stop control` → clicking "Change stop" calls `onChangeStop`.
  - `never renders undefined, null or NaN` across all above payloads.
- [ ] **Step 2: Run** `CI=true npx react-scripts test --watchAll=false src/components/TripSheet.test.js` → FAIL.
- [ ] **Step 3: Implement** `TripSheet`.
  - The countdown region has `aria-live="polite"`.
  - The handle/header is a `<button aria-expanded>` labelled "Show all stops" or "Hide stops".
  - When expanded, scroll the boarding item into view with `scrollIntoView({ block: 'center' })`, guarded for jsdom.
  - Reuse `formatTime` / `relativeUpdate` by moving them from `NextBusCard.js` into `src/utils/time.js`, exported as `formatTime(value)` and `relativeUpdate(value)`.
  - Styles go in `trip.css`, using tokens only.
- [ ] **Step 4: Run** → PASS; run full frontend suite → PASS.
- [ ] **Step 5: Commit** — "Add trip sheet with ordered stop list".

### Task 7: `TripMap`

**Files:**
- Create: `src/components/MapBase.js` (shared `MapTiles`, `FitPositions`)
- Modify: `src/components/BusMap.js` (use `MapTiles`; keep its own `FitMap` behavior via `FitPositions`)
- Modify: `src/components/AnimatedVehicleMarker.js` (`createVehicleIcon(vehicle, color, { muted = false } = {})` adds class `vehicle-icon--muted`)
- Create: `src/components/TripMap.js`, `src/components/TripMap.test.js`
- Modify: `src/styles/map.css` (`.vehicle-icon--muted { opacity: .45; }`)

**Interfaces:**
- Produces:
  - `MapTiles()`: the OSM `TileLayer` exactly as `BusMap` has it today.
  - `FitPositions({ positions, padding = [42, 42], maxZoom = 15 })`.
  - `<TripMap route trip />`: draws the pattern polyline in `route.color` and the boarding stop as a `CircleMarker` (radius 9, fill `#132e43`, white border).
  - The tracked bus is an `AnimatedVehicleMarker`. `otherVehicles` use muted icons.
  - Fit bounds to the tracked bus + boarding stop; with no positioned bus, fit to the pattern.
  - `aria-hidden` is not used; the container gets `aria-label="{route.id} live map for your stop"`.

- [ ] **Step 1: Write failing test** `TripMap.test.js` with `jest.mock('react-leaflet', …)` rendering simple stand-ins (`MapContainer` → div, `Polyline` → `<div data-testid="line">`, `CircleMarker` → `<div data-testid="stop">`, `Marker` → `<div data-testid="bus">`, `useMap` → `{ fitBounds: jest.fn(), setView: jest.fn() }`):
  - `draws route line, boarding stop and buses` → one line, one stop, buses = 1 + otherVehicles.length.
  - `fits to bus and boarding stop` → `fitBounds` called with bounds containing both points (assert via `L.latLngBounds(...).contains`).
  - `works without a bus` → `trip.bus = null` → no crash, zero tracked bus markers.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; `BusMap` behavior unchanged (existing `Tracker.test.js` stays green).
- [ ] **Step 4: Run** full frontend suite → PASS.
- [ ] **Step 5: Commit** — "Add trip map and share map base with route map".

### Task 8: Arrivals page becomes the trip view

**Files:**
- Modify: `src/pages/RouteDetail.js`, `src/pages/RouteDetail.test.js`, `src/styles/trip.css`, `src/styles/arrivals.css` (only if old `.route-workspace` rules conflict)
- Delete: `src/components/NextBusCard.js`, `src/components/NextBusCard.test.js` (behavior now covered by `TripSheet.test.js`; confirm nothing else imports it with `grep -rn NextBusCard src`)

**Interfaces:**
- Consumes: `getTrip`, `TripSheet`, `TripMap`.
- Behavior:
  - With no stop chosen, the page keeps today's picker (`details` open).
  - With a stop chosen, it renders `<section className="trip-view">` containing `TripMap` and `TripSheet`. The picker `details` is closed and opens when `onChangeStop` fires.
  - Polling replaces the `getPredictions` loop with `getTrip`, at the same 30 s visible-only interval and with `AbortController`. The refresh nonce is kept.
  - Responses for a stop or direction other than the current one are ignored, compared on `payload.stopId` / `payload.direction`.
  - Layout:
    - Mobile (`max-width: 55.999rem`): the map fills `calc(100dvh - var(--header-height) - var(--nav-height))` and the sheet is absolutely positioned at the bottom. Collapsed it shows the summary only; expanded it caps at `75dvh` with an internal scroll.
    - Desktop: a two-column grid, map then sheet, with the sheet as a static side panel. The stop list is always visible there, so `expanded` is forced true and the toggle is hidden.

- [ ] **Step 1: Update tests** `RouteDetail.test.js` (mock `getTrip`; `jest.mock('../components/TripMap', () => () => <div>Trip map</div>)`):
  - Keep: `shows the trip controls immediately when no stop is selected`.
  - Replace the first test with `selected stop shows the trip view with countdown and stops away` → "Trip map", "21", "12 stops away".
  - `change stop opens the picker` → click "Change stop" → `details` has `open`, `Boarding stop` select has value `15521`.
  - `ignores a trip response for a previous stop` → first `getTrip` resolves late for stop `15521` after the user switched to `9679`; screen shows the `9679` payload only.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; delete `NextBusCard` files once nothing imports them.
- [ ] **Step 4: Run** full frontend suite and `npx react-scripts build` → PASS, no new ESLint warnings beyond the 3 existing ones (`App.js` `location`, `BusMap.js` useMemo deps, `Tracker.js` `now`).
- [ ] **Step 5: Commit** — "Arrivals page shows map and trip sheet".

### Task 9: Whole-app verification

**Files:** none expected; fix-forward commits only if a check fails.

- [ ] **Step 1:** `python3 -m pytest -q api/tests` and the frontend suite → all PASS.
- [ ] **Step 2:** `npm run build && PORT=5055 python3 -m api.src.app`. Use the `run` skill (or Playwright) at a 390×844 viewport. Open `/route/<route>?direction=<dir>&stop=<stop>` for a route with a reporting bus, then:
  - screenshot collapsed and expanded;
  - confirm the countdown, the stops-away count, the bus marker and the highlighted boarding stop;
  - repeat at 1280×800 to see the side panel.
- [ ] **Step 3:** Open a route with no bus running and confirm "No bus running right now".
- [ ] **Step 4:** `KEY=$(grep '^CENTRO_API_KEY=' backend/.env | cut -d= -f2- | tr -d "\"' "); git grep -c -F "$KEY"` → no matches.
- [ ] **Step 5:** Report results with screenshots; do not deploy.
