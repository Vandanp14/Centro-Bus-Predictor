# Transform Plan

## Stack
- Framework: React 18.3.1 via CRA (react-scripts 5.0.1)
- Routing: react-router-dom 7.4.0
- Styling: Plain CSS (no Tailwind)
- Motion: framer-motion 12.42.2
- Maps: react-leaflet 4.2.1 + leaflet 1.9.4
- Icons: react-icons 5.5.0 (Feather)
- Fonts: "Avenir Next" / Avenir / Segoe UI / Helvetica / Arial sans-serif
- Backend: Flask (Python 3.13) via reverse proxy
- Tests: @testing-library/react 16.2.0

## Product mode
**Native Matte** (primary) — iOS enterprise app feel: dark canvas, matte card surfaces, system font, compact hierarchy, large radii.
**Precision Tool** (secondary) — for the map/tracking view's data density.
Accent color decision: Slate blue `#4F7FA5` — enterprise transit; restrained, meaning-bearing for active/selected/CTA states.

## Screens
| Route | Job | Key components | Gaps |
|---|---|---|---|
| `/` Home | Find arrivals + route overview | Trip planner form, route board (x7), hero split-text | Hero is consumer/marketing (SplitText, "Your bus is already moving."); radial gradient bg; light mode |
| `/tracker` Live map | See live bus positions | BusMap, AnimatedVehicleMarker, route/direction selectors, FitMap | Map key remount bug FIXED; bus count shows; needs enterprise styling |
| `/active` Active buses | Fleet-wide vehicle overview | Vehicle cards grouped by route, 12s polling | Good bones; needs denser layout and enterprise styling |
| `/route/:routeId` Arrivals | View predictions for a stop | NextBusCard, stop selector, segmented control, 30s polling | Solid; styling pass only |
| `/schedule` Schedules | Centro official schedule links | Schedule groups, info aside | Styling pass only |
| `/help` Help | FAQ / rider guide | FAQ details/summary, primer cards | Styling pass only |

## Slop found
- `src/App.css:60` — `radial-gradient` on `.app-shell` background (subtle blue). Remove for clean solid bg.
- `src/App.css:70` — `backdrop-filter: blur(18px)` on topbar. Acceptable per "one glass element" rule. Keep.
- `src/index.css:16` — light-mode bg `#F5F5F0`. Will be replaced with dark `#050506`.
- `src/pages/Home.js:226-228` — "Your bus is already moving." marketing copy. Replace with enterprise utility copy.

## Keep
- Component structure and routing (solid)
- AnimatedVehicleMarker smooth lerp animation
- BusMap + FitMap auto-bounds pattern
- Polling architecture with AbortController + visibility check
- Navbar top/mobile nav dual pattern
- TripContext persistence (last-used route/direction/stop)
- Skeleton loading states
- Empty/error states on most pages
- live-dot pulse animation
- NextBusCard component

## Phase checklist
- [x] Phase 1: audit — complete
- [x] Phase 2: tokens & type — dark-first canvas `#050506`, slate-blue accent, Avenir Next/system font, full token set
- [x] Phase 3: structure — app shell solid bg, hero rebuild (no SplitText), footer simplify
- [x] Phase 4: components — restyle all components to Native Matte: matte cards, dark surfaces, compact hierarchy, radius consistency
- [x] Phase 5: polish — reduced-motion compliance, states audit, copy pass, motion tuning
- [x] Phase 6: verify — build (0 errors), tests (4/4), CSS audit against rubric

## Verification score: **29/30** (pass threshold: 26)
1. Zero hard-ban violations — 2
2. Tokens used consistently — 2
3. Non-Inter typography, tabular-nums — 2
4. One accent, meaning-bearing — 2
5. One dominant element per screen — 2
6. Shell matches mode, nav active states — 2
7. Mobile adapted — 2
8. Interactive states present — 2
9. Data views: loading/empty/error — 2
10. Motion within spec, reduced-motion — 2
11. Accessibility floor — 2
12. Concrete copy, zero buzzwords — 2
13. Radius/spacing consistent — 2
14. Charts: N/A (no charts in app) — 2
15. Visual: enterprise iOS feel, dark matte — 1 (headless; structural changes correct)
