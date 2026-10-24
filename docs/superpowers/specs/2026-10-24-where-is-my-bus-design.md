# Where's my bus — design

Date: 2026-10-24
Status: approved 2026-10-24

## Intent

Centro Oswego Live is for SUNY Oswego students. Once a student has picked a
route, direction, and boarding stop, they want three answers at a glance:

1. **How long** until the bus reaches my stop.
2. **How many stops away** it is.
3. **Where is it** right now.

Second, they want the **whole route's stops in riding order with the next
time at each**, so they can see the bus moving toward them.

Today the arrivals screen (`src/pages/RouteDetail.js` → `src/components/NextBusCard.js`)
answers only "how long", for one stop. The live map lives on a separate page
(`src/pages/Tracker.js` → `src/components/BusMap.js`) and knows nothing about
the student's stop.

## Goals

- After choosing a stop, the student lands on a **map-first screen with a
  bottom sheet** (mockup option C, chosen by the user).
- Collapsed sheet: big minute countdown, stops-away count, bus number,
  arrival clock time.
- Expanded sheet: every stop of the student's direction in riding order;
  stops the bus already passed are greyed, the bus is drawn between the
  stops it is between, the student's stop is highlighted, each stop shows
  its next time.
- Map: route line, the student's stop pinned, the tracked bus prominent,
  other buses on the route faded.
- Stops-away still works when the bus is more than ~45 minutes out (beyond
  Centro's prediction window), e.g. "31 stops away · no time yet".
- Refresh every 30 seconds while the page is visible (existing cadence).

## Non-goals

- No change to the separate route map page (`/tracker`); it stays for
  browsing a route without a stop.
- No schedule-based time estimates for stops beyond the prediction window.
  We show "no time yet" and link the official schedule; we never invent a
  time.
- No push notifications, no "notify me when 5 min away".
- No new transit data source; Centro BusTime v3 only.

## Anti-goals (failure even if it works)

- Showing a time or stop count that is wrong is worse than showing none.
  When the math is unsure, say so ("no time yet", hide the count).
- Telling a student "no service" when a bus is on the route (the bug fixed
  on 2026-10-24 must not come back through this screen).
- A screen that needs several requests per student per refresh.
- Losing the existing honest states: loading, error, stale data, no bus
  running, bus beyond window.

## Facts this design rests on (verified against live Centro data, 2026-10-24)

- `getpredictions?vid=<bus>` returns that bus's upcoming stops in order with
  `prdctdn`/`prdtm`, `rtdir`, `tatripid`, typically up to ~45 minutes ahead,
  and it **can span the bus's next trip** in the other direction (OSW17 bus
  2213 listed its eastbound finish, then the full westbound trip).
- Stops farther than ~45 minutes from any bus get no prediction; Centro
  answers `"No service scheduled"` for them, the same text as for a route
  that is not running.
- `getvehicles` gives each bus `pid` (pattern id) and `pdist` (feet travelled
  along that pattern), plus `tatripid`, `tablockid`, `des`, `dly`, lat/lng.
  It accepts several routes comma-separated.
- `getpatterns?rt=` gives patterns whose points carry `seq`, `typ` (`S` stop /
  `W` waypoint), `stpid`, and `pdist`. **It returns only patterns Centro
  currently considers active**: at 10:23 OSW17 returned only EASTBOUND, at
  ~10:40 it returned two WESTBOUND variants (9757, 9768). A route-level call
  can therefore miss the pattern a bus is on. `getpatterns?pid=` fetches a
  specific pattern.
- Some directions have several pattern variants (OSW17 WESTBOUND 9757 vs
  9768 adds CENTRO GARAGE and OCO MEDICAL CENTER).

## Approaches considered

1. **One backend endpoint does the work — chosen.** A new
   `GET /api/v1/trip` combines stop predictions, the tracked bus's
   predictions, live vehicles, and patterns into one payload. One request
   per refresh, logic testable with the existing pytest suite, Centro calls
   cached and shared by students at the same stop.
2. Browser stitches existing endpoints plus a thin vehicle-predictions
   endpoint. Less backend code, but 4–5 requests per student per refresh,
   more pressure on Centro's rate limits, and the counting logic sits in
   React where it is harder to test. Rejected.
3. Count stops only from the bus's own prediction list. Simplest, but the
   count disappears whenever the bus is beyond ~45 minutes, which is the case
   the user specifically wants covered. Rejected.

The user picked approach 1.

## Design

### Backend: `GET /api/v1/trip?route=&direction=&stop=`

New blueprint `api/src/routes/trip.py`, registered in `api/src/app.py`.
Validation and errors follow the existing routes (`validate_route`,
`json_error`, 400 for bad stop/direction, 404 for unknown route).

Steps:

1. **Stop predictions** for `route`+`stop` (existing `client.predictions`),
   filtered to `direction` as `predictions.py` does today.
2. **Live vehicles** for the route (`client.vehicles`).
3. **Pick the tracked bus.**
   - If step 1 has predictions: the vehicle of the earliest prediction.
   - Else, among live vehicles, the one that will reach the stop first by
     distance: a bus on a pattern of the student's direction whose `pdist`
     is before the stop's `pdist` (closest one wins); otherwise a bus on the
     opposite direction (it must finish that trip and turn around), the one
     with the largest `pdist` / least remaining distance wins.
   - No vehicles: no tracked bus (status `no_service`).
4. **Bus predictions** for the tracked bus (`client.predictions_for_vehicle`,
   new client method → `getpredictions?vid=`, short cache like stop
   predictions).
5. **Patterns.** The route's patterns from `client.patterns(route)`. If the
   tracked bus's `pid` is missing from that list, fetch it with
   `client.pattern(pid)` (new method → `getpatterns?pid=`, long cache). The
   **student's direction pattern** is the variant that contains the
   student's stop; if several do, the one matching the bus's next trip from
   bus predictions, else the longest.
6. **Stops away.**
   - Bus already on the student's direction pattern: count stop points on
     that pattern with `pdist` greater than the bus's `pdist` and less than
     or equal to the stop's `pdist`.
   - Bus on the other direction: stops remaining on its current pattern
     after its `pdist`, plus stops on the student's direction pattern up to
     and including the student's stop — **only when the turnaround is
     confirmed**: the bus's own predictions (step 4) continue into a trip in
     the student's direction. Without that confirmation `stopsAway` is
     `null`, because some buses end their run or go to the garage instead.
   - If the bus's pattern or the student's stop can't be located on a
     pattern, `stopsAway` is `null` (UI hides the count). Never guess.
7. **Ordered stop list** for the student's direction, from the student's
   direction pattern, each entry:
   `{ id, name, lat, lng, state: "passed" | "upcoming", minutes, due,
   predictedAt, isBoarding }`. Times come from the tracked bus's predictions
   matched by `stpid` **and** `rtdir` (the same stop id can appear in both
   directions). Upcoming stops with no matching prediction get
   `minutes: null` → UI "no time yet". `passed` applies only when the bus is
   on this direction's pattern and the stop's `pdist` is below the bus's.
   Stops from the route's `getstops` list that are not on the chosen pattern
   are not shown in this list (they belong to other trip variants); they
   remain selectable in the stop picker.
8. **Bus position in the list:** `busAfterStopId` = last passed stop id (or
   `null` if the bus has not started this direction yet; UI then draws it
   above the first stop with its current destination, as in the mockup).

Response shape (fields not listed keep today's conventions, e.g. `meta`):

```json
{
  "routeId": "OSW17",
  "direction": "WESTBOUND",
  "stopId": "...",
  "status": "live | beyond_window | no_service | unknown",
  "message": "string or null",
  "bus": {
    "id": "2213", "lat": 0, "lng": 0, "heading": 0,
    "destination": "17 Bridge St to Campus", "delayed": false,
    "minutes": 21, "due": false, "predictedAt": "iso",
    "stopsAway": 12, "onBoardingDirection": false
  },
  "stops": [ { "id": "...", "name": "...", "state": "upcoming", "minutes": 8,
               "due": false, "predictedAt": "iso", "isBoarding": false } ],
  "busAfterStopId": null,
  "otherVehicles": [ { "id": "2215", "lat": 0, "lng": 0, "heading": 0 } ],
  "pattern": { "id": "9768", "points": [ { "lat": 0, "lng": 0 } ] },
  "following": [ { "minutes": 50, "predictedAt": "iso", "vehicleId": "2215" } ],
  "meta": { "live": true, "stale": false, "sourceTime": "iso" }
}
```

`status` and `message` reuse the semantics and texts already in
`api/src/routes/predictions.py` (`BEYOND_WINDOW_MESSAGE`,
`NO_SERVICE_MESSAGE`); move them to a shared place rather than copying.
`following` carries the next buses from the stop predictions (what
"Following buses" shows today).

Errors from Centro for the optional parts (bus predictions, patterns) must
degrade the payload, not fail it: e.g. patterns down → `stops: []`,
`stopsAway: null`, countdown still shown. Only a failing stop-predictions
call fails the request, as today.

### Caching

- Stop predictions 12 s and patterns 3600 s (existing).
- Bus predictions: 12 s.
- Vehicles: lower from 60 s to 15 s so the marker moves on each 30 s
  refresh. `getvehicles` is shared by every student on the route, so the
  cost stays per-route, not per-student.
- `getpatterns?pid=`: 3600 s.

Known issue to fix while here: route-level patterns are cached for an hour,
but Centro only returns currently-active patterns, so the cache can hold a
list missing a direction. `api/src/routes/routes.py::_order_by_pattern`
(stop picker order) then falls back to alphabetical for that direction.
Fix: whenever a pattern is fetched (route-level or by `pid`), remember it in
a per-route pattern store that is merged rather than replaced, so the union
of patterns seen grows over the day. Both the stop picker and `/trip` read
from it.

### Frontend

**Route.** The arrivals route stays `/route/:routeId?direction=&stop=`. When
a stop is chosen, `RouteDetail` renders the new trip view instead of
`NextBusCard`. Without a stop it keeps today's direction/stop picker.

**New pieces** (names are suggestions):

- `src/services/apiService.js`: `getTrip(routeId, stopId, direction, options)`.
- `src/components/TripMap.js`: map for one trip. Reuse what `BusMap` has
  (tiles, `AnimatedVehicleMarker`, `createVehicleIcon`, fit-bounds idea);
  extract shared bits rather than duplicating. Shows the pattern line, the
  boarding stop as a distinct pin, the tracked bus, other buses faded. Fit
  bounds to bus + boarding stop, not the whole route, so both are in view.
- `src/components/TripSheet.js`: bottom sheet. Collapsed: countdown,
  stops away, bus number, arrival time. Expanded: ordered stop list per the
  mockup. Toggle by tapping the handle/header (a real `<button>` with
  `aria-expanded`); a drag gesture is optional polish, not required. The
  expanded list scrolls so the boarding stop is in view on open.
- Empty/edge states live inside the sheet: loading skeleton, error,
  `beyond_window` (keep "Bus on the route, no time yet" + schedule link, and
  show stops away if known), `no_service`, stale data label.

**Desktop.** The app has a two-column layout at wide widths. At ≥ 960 px the
sheet sits as a fixed side panel next to the map instead of overlaying it.

**Picker.** Changing direction/stop must stay easy from the trip view: a
"Change stop" control in the sheet header opens today's picker.

**Design system.** Follow the project's existing light theme tokens in
`src/styles/tokens.css` and the rules in
`docs/llm-guides/skills/vandan-ui-system.md`; tabular numerals for times and
counts; respect `prefers-reduced-motion` for the sheet and marker
animation.

### Accessibility

- Countdown and stops away live in an `aria-live="polite"` region (as
  `NextBusCard` does), announced on change, not on every refresh.
- Stop list is an ordered list; passed/upcoming/boarding are conveyed in
  text, not color only.
- The map is supplementary: everything it shows is also in the sheet.

### Tests

- Backend (pytest, `api/tests/`): tracked-bus choice (with predictions,
  beyond window same-direction, beyond window opposite-direction, none);
  stops-away on same pattern, across turnaround, unknown pattern → `null`;
  stop list states and `rtdir`-matched times; bus pid missing from route
  patterns → fetched by pid; partial Centro failures degrade; pattern store
  merges across calls.
- Frontend (Jest/RTL): sheet collapsed/expanded content, every status,
  boarding stop highlighted, "no time yet" rendering, change-stop control,
  no `undefined/null/NaN` in output.
- Fixtures based on the real OSW17 data captured on 2026-10-24.

## Decided by the user

- Audience: SUNY Oswego students.
- Primary questions: how long, how many stops, where is the bus; secondary:
  whole route in order with next time at each.
- Layout: map first with a bottom sheet (mockup C).
- Build approach: single backend endpoint (approach 1).
- Stops-away across a turnaround is shown only when Centro confirms the bus's
  next trip is in the student's direction; otherwise no count.
- Today's fixes are committed on a branch first; this plan builds on them.
- Production switches from the legacy `backend/src/main/app.py` to `api/`
  (found during planning: `deploy-server.sh` started the legacy server, so
  `api/` changes never shipped). `backend/` stays in the repo, no longer
  started.

## Builder's calls (proposed by Claude, not yet confirmed)

- The trip view replaces `NextBusCard` on the arrivals screen; `/tracker`
  stays.
- Tracked bus = next bus to the student's stop; others faded.
- Vehicle cache 60 s → 15 s.
- Tap-to-toggle sheet; drag optional.
- Desktop side panel at ≥ 960 px.
- Pattern store merges patterns over the day. It is in-memory per gunicorn
  worker (`--workers 2`), seeded at startup from the committed
  `docs/centro-routes.json` pattern data so a restart doesn't fall back to
  alphabetical order. No Redis/file persistence. (The export script must
  therefore also write pattern ids and stop `pdist`s for in-app routes.)
- `pdist` is only compared within one pattern. A bus counts as heading to
  the student's stop on its current trip only if **its own `pid`** contains
  the stop. A same-direction bus on a variant without the stop, or one that
  already passed the stop, is not tracked for this trip.
- Tracked-bus order: if stop predictions exist, the earliest one wins. Else a
  same-direction bus (own pattern contains the stop, `pdist` before it)
  closest to the stop wins over any opposite-direction bus. Among
  opposite-direction buses, the one with the least remaining distance on its
  own pattern (`ln - pdist`) wins.
- Buses exist but none can be tracked: status `beyond_window`, `bus: null`,
  `stopsAway: null`.

## Left to the builder

- Exact component split and CSS.
- Whether `BusMap` is refactored to share pieces or `TripMap` composes it.
- Exact skeleton/animation details within the design system.
