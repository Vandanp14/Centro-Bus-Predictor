# Centro Oswego Mobile Wayfinding UI

## Intent

Redesign the visual interface of the Centro Bus Predictor so it feels like a
purpose-built Oswego transit tool and works especially well on phones. The
existing data, routes, trip selection, polling, persistence, and map behavior
are already useful and must remain intact.

## Design direction

Use a mobile-first wayfinding language: warm paper surfaces, deep navy for
primary text and navigation, restrained service yellow for key actions, and
existing route colors where they identify a route. Use clear native sans-serif
type and tabular numerals for arrival times. Favor compact, high-contrast
signage and useful dividers over decorative cards, gradients, blur, or a
marketing hero. Do not use the personal Vandan UI system.

## Shared shell

- Make the header compact and identify the service as Centro Oswego Live.
- Replace the orbit-like CSS mark with a restrained typographic treatment; do
  not present the existing generated bus artwork as an official Centro logo.
- Keep all five existing destinations reachable from the mobile bottom
  navigation: Arrivals, Live map, Active, Schedules, and Help.
- Give mobile controls comfortable touch targets, visible keyboard focus, and
  spacing that respects device safe areas.
- Keep a distinct desktop navigation and allow desktop content to use its
  width; do not simply scale up the phone layout.

## Screen hierarchy

### Arrivals home

- Lead with the Oswego service identity and a direct “find your next bus” task.
- Keep route, direction, and boarding-stop selection in the existing order,
  with the primary action easy to reach on a phone.
- Present available routes as a compact, scannable route board with route
  colors and clear tap affordances.
- Keep service time and data-source details secondary to trip planning.

### Route arrivals

- Show route identity and direction before stop selection.
- Make the selected stop and next arrival the most prominent information.
- Use readable, tabular ETA numerals and a compact list for following buses.
- Keep the existing refresh action, update timestamp, route map, official
  schedule link, and loading, empty, and error states.

### Live map

- Give the map the largest practical area on mobile, with route and direction
  controls immediately above it and a legible map key and vehicle status.
- Keep the existing map data, marker motion, selection, and fit behavior.

### Active buses

- Group buses by route and use compact rows that surface bus ID, delay status,
  direction, and update freshness before secondary details.
- Preserve the existing “show on map” action and empty/error/loading states.

### Schedules and help

- Keep schedule links grouped by SUNY Oswego, city, and regional service; make
  each destination easy to tap and retain the explanation of live estimates
  versus official schedules.
- Keep the existing rider FAQs as native disclosures with concise, readable
  answer spacing.

## Scope and constraints

- UI only: CSS, layout, visual hierarchy, accessibility details, and concise
  interface copy may change.
- Do not change backend code, endpoints, route paths, data shapes, polling
  cadence, trip persistence, or map behavior.
- Do not add dependencies or invent service information.
- Preserve route-specific colors and the existing trip-planning sequence.

## Completion criteria

- A phone-sized viewport makes trip selection, arrival reading, and navigation
  comfortable without horizontal overflow.
- Every existing page has a consistent wayfinding visual language and an
  intentional mobile hierarchy.
- Desktop layouts remain tailored to wider screens.
- Existing controls remain keyboard-operable with visible focus and readable
  contrast; reduced-motion behavior remains in place.
- No API, routing, prediction, persistence, or map behavior changes.
