# Centro Bus Predictor — Repair and Completion Plan

Audit date: 2026-07-23  
Scope: the current working tree, including uncommitted changes  
Goal: turn the shell prototype into a secure, truthful, testable MVP before adding broader analytics

## How to use this plan

- The coordinator owns this file. Parallel agents should not edit it; they should report their task ID, changed files, tests, and remaining risks.
- Give each agent one task card and its listed file ownership. Do not assign two active tasks that own the same file.
- Complete the dependency waves in order. Tasks explicitly marked parallel may run together.
- Use fixtures and mocks for routine tests. Do not make automated tests depend on the live Centro API, live OpenWeather API, or production MySQL.
- Do not repeat or preserve any exposed credential in code, fixtures, logs, commits, or documentation.
- Keep product labels honest. A stop map is not a live bus map, a prediction snapshot is not a schedule, and prediction lead time is not schedule delay.

## Release definition

The first repaired release is complete when a user can:

1. Open or refresh every frontend route without receiving API JSON or a server error.
2. See the currently supported Centro routes from one canonical catalog.
3. Select a route, direction, and stop.
4. See a clearly labeled real-time prediction, its source timestamp, and whether it is stale.
5. See useful loading, empty, offline, and error states.
6. Open a current official schedule through an explicit link.
7. Use the stop map, clearly labeled as a stop map unless actual vehicle-location data is implemented.
8. Use the core flow on mobile and with a keyboard.

The release must also have green automated tests, no committed secrets, a reproducible database migration, and a documented deployment path.

## System understood

### Current data flow

```text
Centro BusTime getpredictions
          |
          v
backend/src/main/agent.py (60-second loop)
          |
          v
MySQL: Routes + Stops + ETA
          |
          v
backend/src/main/app.py (Flask REST + React build)
          |
          v
React pages and src/services/apiService.js

Separate paths:
- Browser -> OpenWeather directly from Home.js
- Tracker.js -> public/routes_stops.json -> BusMap stop markers
```

### What the current system actually provides

- `agent.py` collects prediction records for hard-coded routes and stops.
- Flask exposes route, direction, stop, prediction, average-prediction, schedule, and graph-analysis endpoints.
- Home shows route cards with a prediction-derived status.
- Route Detail selects a direction and stop and requests one prediction.
- Tracker draws static stop coordinates and fetches a prediction when a marker is clicked.
- Schedule opens an official PDF and also tries to render a backend-produced table.
- The requirements document describes live vehicle locations, scheduled-versus-actual analysis, date filters, charts, caching, rate-limit handling, and weather-aware prediction, but the stored data cannot currently support most of those claims.

### Important product-truth gaps

| UI or requirement claim | Current implementation | Required disposition |
|---|---|---|
| “Live bus tracking” | Static stop pins; no vehicle ID or vehicle coordinates are collected | Implement an authorized vehicle feed or rename the screen to “Stops map” |
| “Bus schedule” | `/schedule` reshapes the latest prediction snapshot into one row | Use an official schedule source or only provide an explicit official schedule link |
| “Historical average arrival” | Averages predicted clock times observed at one exact minute | Replace with a defined historical lead-time model or remove the claim |
| “Schedule accuracy/delay analysis” | No scheduled arrival or actual arrival is stored | Defer until those data sources and tables exist |
| Current Oswego route catalog | Hard-coded `OSW10`, `OSW11`, `OSW1A`, `OSW2A` | Refresh against current official service and make the catalog data-driven |
| Weather-enhanced prediction | Browser fetches current weather; weather is not used by the model | Remove from MVP or proxy/cache it and label it informational |

## Audit evidence

### Commands run

| Check | Result |
|---|---|
| `npm run build` | Passes; CRA reports stale browser data and deprecated development-server internals |
| `CI=true npm test -- --watchAll=false` | Fails because no frontend tests exist |
| `python3 -m unittest discover -s backend/src/test -p 'test*.py'` | Fails because the only test intentionally asserts `True == False` |
| `python3 -m py_compile backend/src/main/app.py backend/src/main/agent.py` | Passes |
| Flask test client: `/` | `200 text/html` |
| Flask test client: `/schedule` | `400 application/json`; this collides with the React `/schedule` route |
| Flask test client: `/routes_stops.json` | `200 text/html`; Tracker expects JSON and therefore breaks in the Flask deployment |
| Flask test client: `/tracker` and `/route/OSW10` | `200 text/html` |
| Forced database-connect failure in average helper | Raises `UnboundLocalError` from `conn.close()` |

### Confirmed release blockers

1. Production-style database, Centro, and weather credentials are committed as fallback literals.
2. Flask runs with `debug=True`, enables unrestricted CORS, and returns raw exception strings.
3. API paths share the root namespace with React. Refreshing `/schedule` invokes the API handler instead of the SPA.
4. Flask does not serve `routes_stops.json`; the deployed tracker receives HTML and fails JSON parsing.
5. Local development has no proxy and defaults the API base URL to the CRA origin, so API calls hit the wrong server unless an undocumented environment value is supplied.
6. The only backend test is deliberately red, and no frontend tests exist.
7. `Table_Stops.sql` declares a unique constraint on nonexistent column `stpid`; a fresh schema cannot be trusted to apply.
8. The deployment script references an unversioned `/tmp/deploy-server.sh`, disables SSH host verification, depends on `sshpass`, and modifies SSH authorization.
9. The route catalog is stale. Current official Centro material lists routes 10, 11, 16, 17, 18, 19, and 246 on the Oswego city map; the current SUNY Oswego page lists OSW10, OSW11, OSW18, OSW19, and OSW46. `OSW1A` and `OSW2A` are not in those current listings.

## Decisions and safe defaults

These decisions should be recorded before feature work. The recommended default lets work proceed if no product owner is available.

### DEC-01 — Supported route scope

Recommended MVP: support `OSW10` and `OSW11` first, because they are current campus routes and match the app’s SUNY Oswego focus. Make the catalog configurable so current city routes can be added without code duplication. Do not show `OSW1A` or `OSW2A` unless the current Centro API and official service catalog both confirm them.

### DEC-02 — Schedule behavior

Recommended MVP: remove the fake internal schedule table and show an explicit “View official Centro schedule” link for each supported route. Add an in-app schedule only after a maintained structured source such as authorized GTFS/static schedule data is available.

### DEC-03 — Map behavior

Recommended MVP: ship a “Route stops” map with prediction popups. In parallel, verify whether the project’s Centro API access permits a current vehicle-location endpoint. Only restore “Live buses” language after vehicle positions, timestamps, and refresh behavior are tested.

### DEC-04 — Historical prediction

Recommended MVP: model typical prediction lead time as `predicted_arrival_at - observed_at`, grouped by route, direction, stop, weekday/weekend, and time bucket. Return sample size and generated timestamp. Do not call this “schedule delay.”

### DEC-05 — Deployment target

Recommended assumption: one Flask/Gunicorn service serves `/api/v1/*` and the built React SPA behind HTTPS on the existing school server. If frontend and API will be separate origins, document both origins and restrict CORS accordingly.

## Target API and data rules

The exact URL shape may be adjusted by the architecture owner, but all API endpoints must live below `/api/v1`.

Minimum endpoints:

- `GET /api/v1/health`
- `GET /api/v1/routes`
- `GET /api/v1/routes/{routeId}/directions`
- `GET /api/v1/routes/{routeId}/stops?direction=...`
- `GET /api/v1/predictions?route=...&direction=...&stop=...`
- `GET /api/v1/historical-prediction?route=...&direction=...&stop=...&at=...`

Response rules:

- Use one JSON error shape with a stable code, safe message, and request ID.
- Include source timestamp, server timestamp, freshness/staleness, and source name with prediction data.
- Return an ordered list of upcoming predictions, not one nondeterministic row.
- Validate route, direction, stop, date, hour, and minute values.
- Use `404` for unknown resources, a successful empty result for “no current service” where appropriate, and `503` for unavailable dependencies.
- Never return raw database or upstream exception text.
- Keep all timestamps timezone-aware and serialize them in ISO 8601. Use `America/New_York` for service-day calculations.

## Dependency and parallel-work map

```text
Operator: rotate credentials + confirm DEC-01..05
                          |
          +---------------+---------------+
          |               |               |
       SEC-01          TEST-01          DB-01
          |               |               |
          +---------> ARCH-01 <--------+  |
                          |             |  |
                       DATA-01 <--------+--+
                          |
             +------------+------------+
             |                         |
         INGEST-01                   API-01
             |                         |
             +----------> MODEL-01 <----+
                          |
                       CLIENT-01
                          |
          +---------------+---------------+
          |               |               |
       FLOW-01          MAP-01        SCHEDULE-01
          +---------------+---------------+
                          |
                       UX-01
                          |
              +-----------+-----------+
              |                       |
            QA-01                   OPS-01
              +-----------+-----------+
                          |
                        DOC-01

ANALYTICS-01 is a post-MVP task and begins only after the required source data exists.
```

## File ownership map

| Task | Primary ownership |
|---|---|
| SEC-01 | `.env.example`, `.gitignore`, `backend/src/main/config.py`, initial secret removal in `app.py`, `agent.py`, and `Home.js` |
| TEST-01 | `src/**/*.test.js`, frontend test setup, `backend/src/test/**`, test-only fixtures |
| DB-01 | `backend/src/main/resources/database/**`, new migration tooling |
| ARCH-01 | Flask app factory/routing modules, `src/api.js`, initial API namespace wiring |
| DATA-01 | One canonical route/stop catalog, import/seed script; delete or generate duplicate static catalogs |
| INGEST-01 | Collector/ingestion modules only |
| API-01 | Backend route, repository, service, and schema modules for metadata and real-time predictions |
| MODEL-01 | Historical-prediction service/repository/endpoint and tests |
| CLIENT-01 | `src/services/**`, shared request hooks/state primitives |
| FLOW-01 | `Home.js`, `RouteDetail.js`, `NextBusCard.js`, trip-selection state |
| MAP-01 | `Tracker.js`, `BusMap.js`, map-specific data and tests |
| SCHEDULE-01 | `Schedule.js`, `ScheduleTable.js`, official schedule-link mapping |
| UX-01 | `App.js`, `Navbar.js`, `HelpPage.js`, global styles, public metadata, dead-component cleanup |
| QA-01 | End-to-end tests, CI configuration, test commands |
| OPS-01 | Deployment files, runtime service config, production dependency files |
| DOC-01 | `README.md` and final architecture/operations documentation |

If ARCH-01 splits the current monolithic `app.py`, later backend agents must only edit their assigned new modules. The ARCH-01 owner remains responsible for final route registration.

## Task cards

### [ ] OPERATOR-01 — Revoke and rotate exposed credentials

Priority: P0, release blocker  
Owner: repository/service owner, not an autonomous subagent

Work:

- Rotate the exposed MySQL password.
- Revoke and replace the exposed Centro API key.
- Revoke and replace the exposed weather API key if weather remains in scope.
- Check whether the repository or its history was ever shared. If so, treat every key as compromised.
- Plan a coordinated history cleanup only after rotation. History rewriting is destructive and must not be done casually on a shared repository.

Acceptance:

- Old credentials no longer work.
- New values exist only in the deployment secret store or local ignored environment files.
- No credential values are pasted into an issue, task report, fixture, or plan.

### [ ] SEC-01 — Remove secrets and harden runtime configuration

Priority: P0  
Wave: 1; may run in parallel with TEST-01 and DB-01  
Depends on: none for code changes; OPERATOR-01 is required before release

Work:

- Add a typed/validated backend configuration module.
- Remove all secret fallback literals. Fail startup with a concise configuration error when required values are absent.
- Add `.env.example` with names and safe placeholders only.
- Remove the browser-side weather key and direct weather request. For MVP, remove the optional weather widget; a later backend proxy may restore it.
- Ensure secret-bearing URLs are never logged. The collector currently logs the full Centro URL.
- Set production debug mode off. Do not expose Flask’s debugger.
- Move CORS policy and allowed origins into explicit configuration; same-origin deployment should not need wildcard CORS.
- Add safe top-level error handling that logs an internal request ID and returns a generic response.
- Ignore Python bytecode and cache directories.

Acceptance:

- A repository secret scan and targeted `rg` find no credential literals.
- The frontend bundle contains no weather or Centro key.
- Backend startup fails clearly when required configuration is missing.
- API responses do not include raw exception strings.
- Unit tests cover valid and missing configuration.

### [ ] TEST-01 — Establish a green characterization-test baseline

Priority: P0  
Wave: 1; parallel with SEC-01 and DB-01  
Depends on: none

Work:

- Replace the intentionally failing backend test.
- Add Flask test-client fixtures with a mocked repository/database boundary.
- Add frontend test setup using the already installed React Testing Library packages.
- Add smoke tests for App routing and one stateful component.
- Add deterministic JSON fixtures for routes, directions, stops, current predictions, stale predictions, no-service, and upstream failure.
- Add explicit `test:ci` and backend test commands if needed.

Acceptance:

- Frontend and backend test commands both pass locally without external network or database access.
- Tests fail for real regressions rather than passing unconditionally.
- Current route collision and static-asset behavior are captured before ARCH-01 changes them.

### [ ] DB-01 — Replace ad hoc SQL with reproducible migrations

Priority: P0  
Wave: 1; parallel with SEC-01 and TEST-01  
Depends on: DEC-01 and DEC-04 should be known before final schema

Work:

- Fix the `Stops` unique constraint that references nonexistent `stpid`.
- Introduce ordered, versioned, idempotent migrations with a documented fresh-install command.
- Give every table a primary key and use consistent naming.
- Add foreign-key and query indexes for route, direction, stop, observed timestamp, and predicted timestamp.
- Add a uniqueness rule that prevents duplicate prediction records from repeated collector runs.
- Add an ingestion-run or snapshot identifier so records from split upstream requests can be treated as one logical poll.
- Add a canonical route-stop-direction/order model; do not infer the route catalog from the most recent ETA rows.
- Define a retention policy suitable for the school server’s limited storage.
- Remove the unused weather table from the MVP migration or document the feature that owns it.

Acceptance:

- A clean database can migrate from zero to current.
- Running migrations twice is safe.
- Duplicate prediction ingestion is rejected or upserted.
- Query plans use indexes for the API’s hot paths.
- Migration tests cover fresh install and representative inserts.

### [ ] ARCH-01 — Separate API routing from SPA/static serving

Priority: P0  
Wave: 2  
Depends on: SEC-01, TEST-01

Work:

- Convert Flask startup to an app factory and split API, SPA, configuration, and error handling into focused modules.
- Move every backend endpoint below `/api/v1`.
- Serve any existing built file before falling back to `index.html`.
- Return `index.html` for valid client-side paths such as `/schedule`, `/tracker`, `/help`, and `/route/OSW10`.
- Return JSON `404` for unknown `/api/v1/*` paths.
- Add liveness and dependency-aware readiness behavior.
- Set one development API base mechanism: either a CRA proxy or a documented `REACT_APP_API_BASE_URL`. Do not silently fetch JSON from the CRA server.
- Use a production WSGI entry point; do not start the development server in production.

Acceptance:

- Flask test client returns HTML for `/schedule`.
- `/routes_stops.json` returns JSON if that file still exists, or Tracker no longer requests it.
- `/api/v1/health` returns a small documented payload.
- Direct navigation and refresh work for every frontend route.
- Local frontend development can reach the local Flask API with one documented command.
- No API endpoint conflicts with a frontend route.

### [ ] DATA-01 — Refresh and centralize route/stop metadata

Priority: P0  
Wave: 2  
Depends on: DEC-01, DB-01, ARCH-01

Work:

- Verify the supported route IDs and stop IDs against current official Centro material and the authorized API.
- Remove retired routes from the active catalog; preserve historical rows without presenting retired routes as active.
- Replace `src/Data/busData.js`, `public/routes_stops.json`, hard-coded route arrays, hard-coded collector URL lists, and schedule mappings with one canonical source.
- Include route display name, active dates/status, directions, ordered stops, coordinates, official schedule URL, and last verification date.
- Seed the database or generate frontend fixtures from the canonical source; do not maintain hand-edited duplicates.
- Add a validation script for duplicate stop IDs, missing coordinates, invalid route references, and stale verification dates.

Acceptance:

- Home, detail, map, schedule, collector, and API agree on the same active routes.
- Route stop order is transit order, not alphabetical order.
- Unsupported or retired routes are not offered as active.
- Catalog validation runs in CI.

### [ ] INGEST-01 — Make Centro collection reliable and bounded

Priority: P1  
Wave: 3; can run in parallel with API-01 after DB-01 and DATA-01  
Depends on: SEC-01, DB-01, DATA-01

Work:

- Replace hand-built secret-bearing URLs with a client that passes query parameters safely.
- Use a `requests.Session`, connect/read timeouts, bounded retries, exponential backoff, and explicit handling for rate-limit responses.
- Track request counts and upstream status without logging keys.
- Write one logical poll in a transaction or ingestion snapshot, even when stop IDs require multiple upstream requests.
- Batch inserts/upserts instead of committing for every row.
- Normalize `DUE`, missing predictions, delayed flags, direction, and timestamps.
- Use `America/New_York` explicitly and handle daylight-saving transitions.
- Replace the every-minute overnight wakeup with a calculated sleep or scheduler.
- Support graceful shutdown and structured logs.
- Add retention cleanup and metrics for last successful poll, rows received, rows rejected, and upstream latency.

Acceptance:

- Replaying the same upstream payload does not duplicate rows.
- A partial upstream failure does not publish a mixed snapshot as complete.
- A hung upstream request cannot hang the collector indefinitely.
- Logs contain no API key.
- Unit tests cover success, timeout, invalid JSON, upstream error, no-service, partial batch failure, duplicate payload, and shutdown.

### [ ] API-01 — Correct metadata and real-time prediction APIs

Priority: P1  
Wave: 3; may run in parallel with INGEST-01 in separate modules  
Depends on: ARCH-01, DB-01, DATA-01

Work:

- Make routes, directions, and stops read canonical metadata rather than the latest ETA snapshot.
- Replace the current grouped `MIN(...) ... LIMIT 1` prediction query with deterministic, future-only ordering.
- Return all useful upcoming predictions within a defined limit.
- Filter by route, direction, and stop consistently.
- Add source age and stale/no-service semantics. “Same calendar date” is not a sufficient freshness check.
- Validate identifiers and time inputs.
- Use repository/service boundaries so SQL behavior is unit-testable.
- Remove or retire the fake `/schedule` and latest-snapshot `/graphanalysis` behavior unless their replacements are implemented.

Acceptance:

- The same request always returns predictions in earliest-arrival order.
- Old predictions are never presented as current.
- Stale data is distinguishable from no scheduled service and from server failure.
- A route’s complete ordered stop list remains available outside operating hours.
- API contract tests cover all documented response states.

### [ ] MODEL-01 — Replace the misleading average-prediction calculation

Priority: P1  
Wave: 4  
Depends on: DB-01, INGEST-01, API-01, DEC-04

Work:

- Fix connection cleanup so connection failure cannot raise `UnboundLocalError`.
- Validate time ranges and timezone-aware request timestamps.
- Compute prediction lead seconds from each historical observation instead of averaging clock-of-day values.
- Use a documented recency window and comparable weekday/weekend and time bucket.
- Handle midnight correctly with full datetimes.
- Return predicted arrival, sample count, aggregation window, method/version, and confidence/dispersion measure.
- Define a minimum sample threshold and return a truthful insufficient-data state.
- Remove Pandas from the request path if a small SQL/Python aggregation is sufficient.

Acceptance:

- Unit tests cover connection failure, empty data, one sample, midnight crossing, daylight-saving boundaries, outliers, and invalid input.
- UI copy calls the result a historical estimate or typical prediction, not a scheduled arrival or actual delay.
- Endpoint performance is bounded by indexed queries.

### [ ] CLIENT-01 — Build a consistent frontend API and async-state layer

Priority: P1  
Wave: 4  
Depends on: ARCH-01, API-01

Work:

- Centralize URL construction with `URL`/`URLSearchParams`.
- Stop swallowing every failure into `[]` or `null`; preserve typed no-data, offline, timeout, stale, and server-error states.
- Add request cancellation or stale-response guards when selections change.
- Add bounded polling for live predictions and expose last-updated time.
- Keep response-shape normalization in one place.
- Add unit tests for query encoding, non-JSON responses, error payloads, cancellation, and stale responses.

Acceptance:

- Components do not need to inspect raw HTTP status codes.
- Selecting a new route cannot be overwritten by an older in-flight response.
- API calls do not silently parse `index.html` as JSON.
- Polling stops when the component unmounts or the tab is not active.

### [ ] FLOW-01 — Repair Home and Route Detail user journeys

Priority: P1  
Wave: 5; parallel with MAP-01 and SCHEDULE-01 after CLIENT-01  
Depends on: CLIENT-01, DATA-01, MODEL-01

Work:

- Use the canonical route list and a defined representative stop instead of falling back to stop `15521` for every route.
- Add explicit loading, current, stale, no-service, offline, and error states to route cards.
- Make route cards semantic links/buttons and keyboard accessible.
- Replace `nextArrivals` string sentinels with a consistent object/state model. `NextBusCard` currently renders blank fields for `"Loading..."` and error strings.
- Use the shared Navbar on Route Detail.
- Persist route, direction, and stop in the URL so refresh and deep links work.
- Remove or simplify `TripContext` if URL state makes it redundant. Fix the current Schedule fallback in which the always-truthy default context prevents `location.state` from being used.
- Poll real-time prediction data at the agreed interval and show last updated.
- Clearly separate current prediction from historical estimate.

Acceptance:

- Core selection flow works after refresh and from a copied URL.
- No state renders `undefined`, a blank arrival row, or a false “Coming Soon.”
- Failure of one route card does not break all cards.
- Keyboard and screen-reader users can operate all controls.
- Component tests cover all async states and rapid selection changes.

### [ ] MAP-01 — Make the tracker accurate and honest

Priority: P1  
Wave: 5; parallel with FLOW-01 and SCHEDULE-01  
Depends on: DEC-03, DATA-01, CLIENT-01, API-01

Required MVP work:

- Rename stop objects and props currently called `buses`.
- Load canonical ordered stops and directions through the API or generated catalog.
- Fit map bounds to the selected route.
- Include direction in prediction requests.
- Replace permanent prediction caching with bounded refresh and timestamp display.
- Remove reliance on Leaflet’s private `_popup` field.
- Use stable stop IDs as marker keys.
- Add map loading, error, empty, and tile-failure states.
- Label the page “Route stops” and update help text unless live vehicles are implemented.

Optional live-vehicle branch:

- Verify the project’s authorized Centro access and terms for vehicle locations.
- Store vehicle ID, route, direction, coordinates, heading, and observed timestamp.
- Add a vehicle endpoint and 30–60 second refresh.
- Use visually distinct vehicle and stop markers and discard stale vehicles.

Acceptance:

- The page never describes stop coordinates as bus locations.
- Every popup prediction is for the marker’s route, direction, and stop.
- Route bounds work for campus and city routes.
- If live vehicles ship, their timestamps and stale behavior are tested.

### [ ] SCHEDULE-01 — Replace the false schedule implementation

Priority: P1  
Wave: 5; parallel with FLOW-01 and MAP-01  
Depends on: DEC-02, DATA-01, CLIENT-01

Recommended MVP work:

- Remove the backend-derived table that labels predictions as scheduled arrival times.
- Replace automatic `window.open` on dropdown change with a normal, explicit link/button.
- Use current official route pages or verified PDF links from the canonical catalog.
- Add `noopener`/`noreferrer` behavior for a new tab.
- Keep route selection in the page and allow the user to switch routes.
- Explain that Centro owns and updates the official schedule.

Structured-schedule branch, only if an authorized maintained source exists:

- Ingest scheduled trips, service calendars, stop sequences, and exceptions.
- Render directions and trips in route order.
- Keep scheduled and predicted times as separate fields.

Acceptance:

- The app never labels a prediction snapshot as a schedule.
- Selecting a route does not trigger an unsolicited popup.
- Every active route has a verified official schedule destination.
- Direct navigation and refresh of `/schedule` return the React page.

### [ ] UX-01 — Finish navigation, accessibility, metadata, and dead-code cleanup

Priority: P1  
Wave: 6  
Depends on: FLOW-01, MAP-01, SCHEDULE-01

Work:

- Make one responsive Navbar work on every page, including route detail and narrow mobile widths.
- Add a real not-found route and an application error boundary.
- Convert FAQ toggles from clickable `div`s to semantic buttons with `aria-expanded` and keyboard behavior.
- Fix outdated and contradictory help copy.
- Prevent the fixed disclaimer and tracker button from overlapping content.
- Add reduced-motion support and preserve visible focus states.
- Audit labels, color contrast, heading order, status announcements, and touch target size.
- Replace generic Create React App metadata and manifest values.
- Remove or repair unused `FilterBar`, `MapView`, and `HeroSection`. `HeroSection` currently imports an asset from a nonexistent relative path.
- Remove unused dependencies after an import audit.

Acceptance:

- Core pages pass automated accessibility checks with no serious violations.
- Mobile navigation and all core controls work at 390 px width.
- Unknown routes show a helpful 404 page.
- Production console has no React prop warnings or debug logging.
- Build has no broken or unreachable component imports.

### [ ] ANALYTICS-01 — Implement real historical analytics

Priority: P2, post-MVP  
Depends on: a verified scheduled-arrival and/or actual-arrival data source

Do not start this task merely because `graphanalysis` exists.

Work:

- Define each metric and its source fields.
- Store scheduled and actual arrival events if available.
- Add date range, route, direction, stop, weekday, and time-of-day filters.
- Compute schedule deviation and sample quality using complete historical windows, not the latest snapshot.
- Add accessible table summaries alongside charts.
- Version the model and expose sample count and missing-data warnings.

Acceptance:

- Every chart can be reproduced from an API response and has a written metric definition.
- “Delay” is only used when scheduled or expected baseline data exists.
- Timezone, service-day, missing-trip, and outlier behavior are tested.

### [ ] QA-01 — Add integration, end-to-end, security, and CI gates

Priority: P0 before release  
Wave: 7; may run in parallel with OPS-01 after feature tasks stabilize  
Depends on: all MVP feature tasks

Work:

- Add backend unit and contract tests for validation, repository queries, freshness, errors, and SPA routing.
- Add frontend tests for the core selection, map, schedule, and error flows.
- Add browser tests for direct navigation, refresh, mobile layout, keyboard navigation, and mocked offline/stale states.
- Add CI jobs for frontend tests/build, backend tests, migration validation, catalog validation, dependency audit, and secret scan.
- Set meaningful coverage thresholds around critical logic rather than chasing total line coverage.

Required release checks:

```bash
npm run build
CI=true npm test -- --watchAll=false
python3 -m unittest discover -s backend/src/test -p 'test*.py'
python3 -m compileall backend/src/main
```

Acceptance:

- All required checks pass from a clean checkout.
- CI does not need production credentials.
- A failure in API routing, static assets, stale predictions, or schema migration is caught automatically.

### [ ] OPS-01 — Replace the unsafe, incomplete deployment path

Priority: P0 before release  
Wave: 7; parallel with QA-01  
Depends on: ARCH-01, SEC-01, QA-ready health endpoint, DEC-05

Work:

- Replace `deploy.sh`; do not depend on an unversioned `/tmp/deploy-server.sh`.
- Remove `sshpass`, `StrictHostKeyChecking=no`, interactive password capture, and automatic `authorized_keys` modification.
- Document a least-privilege deploy account and normal host-key verification.
- Build React reproducibly and run Flask through Gunicorn or another production WSGI server.
- Configure a process supervisor, restart policy, structured logs, health checks, and environment secret injection.
- Put HTTPS/reverse-proxy configuration in version control without private keys.
- Add database migration and rollback steps.
- Add pre-deploy checks and post-deploy smoke tests.
- Pin only required Python packages; remove unrelated packages from `requirements.txt`.

Acceptance:

- A documented clean-server deployment succeeds without hidden temporary files.
- No credential is passed on a command line or written to the repository.
- Direct SPA routes, `/api/v1/health`, static assets, and one mocked/staging prediction flow pass after deploy.
- Rollback steps are tested and documented.

### [ ] DOC-01 — Make documentation match the finished system

Priority: P1  
Wave: 8  
Depends on: completed MVP tasks

Work:

- Rewrite README setup for frontend, backend, migrations, collector, tests, and production build.
- Document environment variables without values.
- Add a concise architecture/data-flow section and API contract link.
- Record the supported route scope and catalog verification process.
- Document the difference between live prediction, historical estimate, route stops, and official schedule.
- Record known limitations and deferred SRS features.
- Fix outdated setup claims, typos, and unused dependency references.

Acceptance:

- A new contributor can run the app and tests from a clean checkout.
- No hidden production assumption is required.
- README language matches what the UI and data actually provide.

## Coordinator merge order

1. Merge SEC-01, TEST-01, and DB-01.
2. Rebase and merge ARCH-01.
3. Merge DATA-01.
4. Merge INGEST-01 and API-01; resolve only through their module boundaries.
5. Merge MODEL-01, then CLIENT-01.
6. Merge FLOW-01, MAP-01, and SCHEDULE-01.
7. Merge UX-01.
8. Merge QA-01 and OPS-01.
9. Run all release checks, then merge DOC-01.

After every merge:

- Re-run the owning task’s tests.
- Run frontend build if frontend files changed.
- Run backend tests if backend files changed.
- Re-run secret scan if configuration, deployment, or logging changed.
- Do not “fix” unrelated dirty files during conflict resolution.

## Deferred until a real data source exists

- Actual bus arrival events
- Schedule adherence and true delay analysis
- Fastest-route recommendation
- Nearby-stop route comparison
- Weather as a predictive factor
- Live vehicle movement if the authorized API does not supply it
- Administrator database UI

These are valid requirements, but implementing their UI before their data contracts would recreate the current shell-prototype problem.

## Reference sources

- Local requirements: `Team E Requirements Specification.docx`
- Current Centro SUNY Oswego route listing: <https://www.centro.org/routes-schedules/higher-education>
- Current Centro Oswego city schedule/map PDF: <https://www.centro.org/docs/default-source/pdf-schedules/oswego/osw-city.pdf?sfvrsn=57939e6_6>
- Current OSW10/OSW11 PDF: <https://www.centro.org/docs/default-source/pdf-schedules/oswego/osw10-osw11.pdf?sfvrsn=3a62a600_4>
- Centro BusTracker/API access information: <https://bus-time.centro.org/bustime/home.jsp>

Official route and schedule material changes over time. DATA-01 must record a verification date and should not treat these URLs as permanent identifiers.
