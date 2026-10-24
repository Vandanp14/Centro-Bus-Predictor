# Mobile Wayfinding UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Apply the approved mobile mockups across Centro Oswego Live while preserving its existing transit behavior.

**Architecture:** Keep the React page components, router, context, services, and Leaflet integration. Reorganize presentation CSS by responsibility, then change JSX composition and styling within the existing pages. Use fluid mobile layouts with a persistent bottom navigation and a separate desktop shell.

**Tech Stack:** React 18.3.1, react-router-dom 7.5.3, react-icons 5.5.0, react-leaflet 4.2.1, Leaflet 1.9.4, CRA/react-scripts 5.0.1, plain CSS. Testing Library React 16.3.0 and user-event 13.5.0. Versions are resolved from `package-lock.json`; consult installed package types/source before changing library calls.

**Spec:** `docs/superpowers/specs/2026-10-23-mobile-wayfinding-ui-design.md`

**Approved visual reference:** `docs/superpowers/mockups/mobile-wayfinding.html`

## Global Constraints

- UI only: CSS, layout, visual hierarchy, accessibility details, and concise interface copy may change.
- Do not change backend code, endpoints, route paths, data shapes, polling cadence, trip persistence, or map behavior.
- Do not add dependencies or invent service information.
- Preserve route-specific colors and the existing trip-planning sequence.
- Do not use the personal Vandan UI system.
- Preserve the current loading, empty, error, stale, and delayed information.
- Use the approved palette, typography, and three screen compositions from the visual reference. Sample countdowns, stops, bus IDs, route geometry, and vehicle counts must never become production constants.
- Keep desktop controls appropriate to wider screens. The mockup frame height is not a production layout constraint.
- Do not use desktop/computer control. If rendering screenshots, use an isolated headless browser; stop any temporary process after validation.
- Leave unrelated `.opencode/` and generated `.superpowers/` state out of implementation commits. The old `TRANSFORM_PLAN.md` describes a superseded redesign and is not design authority.

## Review Focus

1. Narrow phones, landscape, long labels, and 200% zoom: no horizontal page overflow or content hidden behind bottom navigation. Validate in Tasks 1, 2, and 6.
2. Restored or incomplete trips: route → direction → stop dependencies and encoded navigation must still work. Pin with the Task 2 integration test.
3. Due, loading, error, empty, stale, delayed, or time-only predictions: the presentation must preserve their meaning. Cover with Task 3 component checks.
4. Missing map data and zero vehicles: preserve honest status text, Leaflet zoom/attribution, and usable map space. Validate in Task 4.
5. Keyboard use, safe-area insets, and reduced motion: controls remain visible, reachable, and clearly focused. Validate in Tasks 1 and 6.

## Files and responsibilities

- `src/App.css`: import entry for the presentation styles; no duplicate late overrides.
- `src/index.css`: reset, body type, selection, and global focus behavior.
- `src/styles/tokens.css`: approved palette, dimensions, type, spacing, radii.
- `src/styles/shell.css`: header, navigation, page containers, footer, error boundary.
- `src/styles/controls.css`: buttons, form controls, route badges, status banners, skeletons.
- `src/styles/home.css`: trip planner and route directory.
- `src/styles/arrivals.css`: route header, stop selection, ETA, following arrivals.
- `src/styles/map.css`: map page, Leaflet chrome, existing vehicle and popup styles.
- `src/styles/reference.css`: active buses, schedules, help, legacy filter/table components.
- Existing JSX files retain their data/state responsibilities; modify only their presentation.

### Task 1: Establish the design system and mobile shell

**Files:** Modify `src/App.css`, `src/index.css`, `src/App.js`, `src/components/Navbar.js`, `public/index.html`; create the seven style files listed above.

**Interfaces:** Existing class names remain the style hooks. `Navbar()` retains all five route destinations and its `/route/*` → Arrivals active-state rule. No router or context APIs change.

- [x] Record baseline `npm run test:ci -- --runInBand` and `npm run build`; inspect results before changing presentation.
- [x] Split the existing CSS into the listed files and import them through `App.css` in token → shell → control → page order. Preserve existing vehicle-marker and popup geometry during extraction.
- [x] Set the approved palette exactly. Use Helvetica Neue/Arial for body and tabular ETA numbers; keep monospace labels at a readable minimum of 10px. Set shared surface radii to 14px, controls to 8px, route badges to 7px.
- [x] Replace the orbit mark with the typographic `centro` treatment and `OSWEGO LIVE` descriptor. Add a labeled `/help` link in the compact mobile header. Keep desktop navigation distinct.
- [x] Implement the mockup bottom navigation at widths below 56rem, with five equal columns and full-cell tap targets at least 44px high. Use a solid warm-white surface, selected pale-yellow fill, a 1px divider, and `env(safe-area-inset-bottom)` padding. Reserve matching space beneath page content and footer.
- [x] Make form fields at least 48px high and 16px on phones to avoid input zoom. Keep visible focus, hover, pressed, disabled, and reduced-motion states. Do not add ambient animation. Update the document theme color to `#f5f4ed`.
- [x] Validate at 320×568, 390×844, 844×390, and 1440×1000: all five destinations reachable, active state correct on `/route/OSW10`, no covered footer/controls, no page overflow. Tab through navigation and check safe-area padding with a simulated inset.
- [x] Run `npm run build`. Expected: successful compilation. Commit only this task's presentation files as `feat(ui): establish mobile wayfinding shell`.

### Task 2: Rebuild the home trip finder and route directory

**Files:** Modify `src/pages/Home.js`, `src/styles/home.css`; create `src/pages/Home.test.js`.

**Interfaces:** Preserve `Home()` and its `TripContext` contract, `getRoutes`, `getDirections`, `getStops`, and `handleSubmit`. The route destination remains `/route/:routeId?direction=...&stop=...`.

- [x] Add a behavior-preservation integration test using MemoryRouter, TripContext, mocked service calls, and user-event v13. Mock route `OSW10`, directions `FROM CAMPUS` and `TO CAMPUS`, and stop `{ id: '15521', name: 'Campus Center' }`. Use these exact assertions around the existing form interactions:

```jsx
expect(screen.getByLabelText('Direction')).toBeDisabled();
expect(screen.getByLabelText(/Stop|Boarding stop/i)).toBeDisabled();
userEvent.selectOptions(screen.getByLabelText('Route'), 'OSW10');
await screen.findByRole('option', { name: 'FROM CAMPUS' });
userEvent.selectOptions(screen.getByLabelText('Direction'), 'FROM CAMPUS');
await screen.findByRole('option', { name: 'Campus Center' });
userEvent.selectOptions(screen.getByLabelText(/Stop|Boarding stop/i), '15521');
userEvent.click(screen.getByRole('button', { name: 'See live arrivals' }));
expect(setTrip).toHaveBeenCalledWith({
  route: 'OSW10', direction: 'FROM CAMPUS', stop: '15521', stopName: 'Campus Center',
});
// A route element using useLocation() renders pathname + search into this output.
expect(screen.getByTestId('destination')).toHaveTextContent(
  '/route/OSW10?direction=FROM+CAMPUS&stop=15521'
);
```

- [x] Run `npm run test:ci -- --runInBand src/pages/Home.test.js`. Expected: baseline trip behavior passes; resolve test setup failures without changing services.
- [x] Follow the reference home composition: compact location eyebrow, `Your next bus.` heading, short service description, one bordered trip panel, yellow `See live arrivals` action, compact route list. Preserve every route and all planner/catalog warnings. Keep native labeled selects and dynamic options.
- [x] Move service readouts below the primary task. On desktop, place the trip finder and route directory in complementary columns; on phones stack them. Let long route names wrap while keeping badges and action affordances aligned.
- [x] Validate restored selections, disabled dependent controls, loading options, failed direction/stop requests, and a long stop/direction label at 320px. Verify keyboard selection and no button overlap at 200% zoom.
- [x] Run the Home test and build. Expected: passing test and compilation. Commit as `feat(ui): redesign mobile trip finder`.

### Task 3: Build the arrival countdown screen

**Files:** Modify `src/pages/RouteDetail.js`, `src/components/NextBusCard.js`, `src/components/NextBusCard.test.js`, `src/styles/arrivals.css`.

**Interfaces:** Keep `NextBusCard({ route, stopName, direction, payload, loading, refreshing, error, onRefresh })`. It may use an existing Router `Link` for the map action. RouteDetail retains its effects, search parameters, polling, and persistence.

- [x] Wrap existing NextBusCard renders with MemoryRouter. Add a test named `links the arrival to its route map` using the current `route` fixture, direction `FROM CAMPUS`, stop `Campus Center`, and one prediction `{ minutes: 8, predictedAt: '2026-07-25T20:19:00-04:00', vehicleId: '2212' }`:

```jsx
expect(screen.getByRole('link', { name: 'View route map' })).toHaveAttribute(
  'href', '/tracker?route=OSW10&direction=FROM%20CAMPUS'
);
```

- [x] Run `npm run test:ci -- --runInBand src/components/NextBusCard.test.js`. Expected: the new map-link assertion fails before its markup exists; existing prediction assertions pass.
- [x] Match the reference route badge/title, boarding-stop context, navy ETA panel, large number with smaller `min` unit, yellow map action, following-arrival rows, and update footer. Construct the link from `route.id` and `encodeURIComponent(direction)`; never use the preview's hardcoded values. Keep direction and stop controls editable above the ETA panel.
- [x] Preserve `Due`, time-only fallback, delay information, source/stale labels, refresh controls, and official schedule access. Only show a `min` unit when minutes are numeric and the prediction is not due. Do not impose the preview's 830px frame height.
- [x] Extend component checks for loading, error, no selection, no predictions, stale source, delayed vehicle, and missing minutes. Assert existing state titles/text (`Loading live arrivals`, `Live arrivals did not load`, `Pick where you are boarding`, `No upcoming prediction`, `Stale Centro update`, `Centro reports a delay`) and time-only output without a false minutes unit.
- [x] Run the NextBusCard test file and build. Compare numeric, Due, and empty presentations at 320px and 390px. Expected: usable controls, readable following buses, passing assertions and compilation. Commit as `feat(ui): add mobile arrival board`.

### Task 4: Give the live map the phone viewport

**Files:** Modify `src/pages/Tracker.js`, `src/styles/map.css`. Read `src/components/BusMap.js` and `src/components/AnimatedVehicleMarker.js` as behavior references.

**Interfaces:** Preserve `BusMap({ route, direction, patterns, stops, vehicles })`, map component identity, marker geometry, route/direction query parameters, and all data effects. No changes to BusMap or AnimatedVehicleMarker logic.

- [x] Match the reference compact page title, route/direction controls, large map area, legible key, and compact route/status summary. Keep actual existing route geometry, tile provider, stops, and bus data.
- [x] Size the mobile map with a fluid viewport-based height and a useful minimum; allow the page to scroll on short landscape screens. Keep map interactions clear of navigation and bottom overlays. Route summary may sit below the map when a narrow viewport would obscure zoom or attribution.
- [x] Remove any unconditional decorative LIVE badge from the wrapper; source status and actual vehicle counts must drive the visible information. Preserve zero-vehicle messages and route-arrival links.
- [x] Validate a selected route, route change, missing direction, loading map, API failure, zero vehicles, and long direction names at 390×844 and 844×390. Verify zoom buttons, popups, attribution, and direction controls remain reachable. Confirm the diff leaves polling, FitMap, and vehicle movement untouched.
- [x] Run `npm run build`. Expected: successful compilation. Commit as `feat(ui): adapt route map for mobile riders`.

### Task 5: Extend the same system to active buses, schedules, and help

**Files:** Modify `src/pages/ActivePage.js`, `src/pages/Schedule.js`, `src/pages/HelpPage.js`, `src/styles/reference.css`.

**Interfaces:** Existing component exports, links, FAQ disclosures, groups, and data effects remain unchanged. These pages consume the tokens, shell, controls, and route badges from Task 1.

- [x] Present active buses as compact route groups with clear bus ID, delay status, direction, update time, and map action. Use two-column secondary details on phones where four columns would crowd long values. Preserve empty/error/loading copy and actual source data.
- [x] Restyle schedule groups into generous tappable route rows with official external-link affordances. Move the schedule-versus-live explanation after the route list on mobile and beside it on desktop. Preserve recent-trip links and every schedule URL.
- [x] Restyle help as concise rider instructions and native details/summary FAQs. Preserve the answers, default disclosure state, and arrivals action. Avoid oversized icon tiles or a repeated card grid.
- [x] Validate an active bus with long direction text, no active buses, schedule rows at 320px, and FAQ keyboard toggling. Compare mobile page headings and list rhythms with the approved home/arrival screens.
- [x] Run `npm run build`. Expected: successful compilation. Commit as `feat(ui): align rider reference screens`.

### Task 6: Verify the complete presentation and hand off

**Files:** Review all task diffs; update this plan's completion checkboxes. No backend/service modifications are expected.

- [x] Run `npm run test:ci -- --runInBand` and `npm run build`. Expected: every frontend test passes and production compilation succeeds. Run `git diff --check`; expected no whitespace errors.
- [x] Review `/`, `/route/OSW10`, `/tracker`, `/active`, `/schedule`, `/help`, and an unknown route at mobile and desktop widths. Use isolated headless rendering or manual user inspection; do not control desktop windows.
- [x] At 320×568, 390×844, 844×390, 1024×768, and 1440×1000 verify no horizontal page overflow, persistent navigation clearance, legible content, and an intentional desktop layout. At 200% zoom verify critical controls and source/error text remain available. Check visible focus and reduced-motion behavior.
- [x] Compare the three main pages to the approved mockup for palette, hierarchy, density, route-badge treatment, and map prominence. Confirm no sample bus IDs, countdowns, vehicle counts, or illustrative route geometry entered app code.
- [x] Inspect the final diff for unauthorized changes to service calls, endpoints, polling, query parameters, trip persistence, routes, or Leaflet behavior. Resolve material issues and rerun only affected checks.
- [x] Stop temporary validation servers/processes. Report changed screens, checks performed, and any remaining limitations; leave deployment and merge to the user's separate instruction.

## Plan self-review

The six tasks cover the shared shell, all six existing screens, the approved mockup, and all five review conditions. The only new component behavior is an existing route-map destination exposed inside the arrival card; its props and data contracts remain intact. Production data, polling, routes, and marker movement are outside the change. Functional checks preserve the real trip flow; visual checks assess CSS without writing tests that merely repeat style declarations.

## Execution results

Implemented on `ui/mobile-wayfinding`. All 19 frontend tests pass; production build passes with three preexisting lint warnings. Headless Chromium passed 35 route/viewport combinations, seven data states, keyboard focus, reduced-motion, simulated safe areas, and 200% equivalent reflow. No backend/service/data/Leaflet logic changes. Independent review found muted-text contrast and a duplicate desktop Help icon; both are corrected. Muted text is slightly darker (`#627078`) to exceed 4.5:1 on paper. Trip editing uses a native disclosure once a stop is selected to keep the ETA visible sooner. Test-only Router mappings accommodate the installed package exports. The unchanged Carto tile provider returns API-key-required tiles; live source availability and physical iOS/screen-reader behavior were not covered by fixture-based browser checks. User subsequently authorized git push and production deployment.
