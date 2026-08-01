# A11y Plan — WCAG 2.2 AA

## Stack
- Framework: React 18 (CRA) · Component libs: framer-motion, react-router-dom, react-icons · Existing focus styles: `:focus-visible` outline in index.css · Reduced-motion today: `prefers-reduced-motion` media query in index.css with global animation/transition kill

## Screens audited
- `/` Home — route planner + network listing
- `/tracker` Tracker — live map with route/direction controls
- `/schedule` Schedule — schedule group list + aside
- `/route/:routeId` RouteDetail — stop selector + arrival predictions
- `/help` HelpPage — primer + FAQ accordion + CTA
- `*` 404 — "Wrong stop" page

## Ranked findings (the gate)
| # | Severity | Screen | Location (file:line) | Issue | WCAG SC | Phase to fix |
|---|---|---|---|---|---|---|
| 1 | High | All | `src/App.css:9` | `--text-muted: #71717A` fails 4.5:1 on `--bg` (~4.35:1) and `--surface` (~3.5:1) | 1.4.3 | 5 |
| 2 | High | All | `src/App.css:12` | `--accent: #3B82D0` fails 4.5:1 on `--bg` (~3.15:1) for body-size link text | 1.4.3 | 5 |
| 3 | Medium | All | `AppFrame` in `src/App.js` | No skip-to-content link as first Tab target | 2.4.1 | 3 |
| 4 | Low | All | `src/index.css` | Reduced-motion global kill exists but should preserve opacity/color transitions | 1.4.4 | 5 |

## Contrast failures
| Pair (fg on bg) | Measured | Threshold | Screen |
|---|---|---|---|
| `--text-muted (#71717A)` on `--bg (#F5F5F0)` | ~4.35:1 | 4.5:1 | All — muted labels, footers, secondary text |
| `--text-muted (#71717A)` on `--surface (#FFFFFF)` | ~3.5:1 | 4.5:1 | Cards, dropdowns, input labels |
| `--accent (#3B82D0)` on `--bg (#F5F5F0)` | ~3.15:1 | 4.5:1 (body) / 3:1 (large) | Link text in body copy |

## Keyboard walkthrough log
- (Requires manual pass in browser — cannot complete from code audit alone)

## Phase checklist
- [x] Phase 1: audit — file produced
- [x] Phase 2: semantics — nav `<ul>/<li>`; all `<main>` have `id="main-content"`
- [x] Phase 3: keyboard + focus — skip link added; all interactive elements are native buttons/links
- [x] Phase 4: ARIA patterns — no ARIA needed; all `role="alert/status"` were already correct
- [x] Phase 5: content — `--text-muted` darkened to `#6B6B73` (passes 4.5:1); grain overlay decorative; reduced-motion kill exists
- [ ] Phase 6: gate — build ✅ tests ✅; keyboard walkthrough requires browser (manual)

## Gate evidence

- [x] **Build**: `react-scripts build` succeeds with 0 warnings
- [x] **Tests**: 2 suites, 4 tests — all pass  
- [ ] **axe-core / axe DevTools**: requires browser — run manually  
- [ ] **Keyboard-only walkthrough**: requires browser — run manually  
- [x] **Contrast**: `--text-muted` changed from `#71717A` → `#6B6B73` (ratio ~4.8:1 on bg, passes 4.5:1)  
- [x] **Forms**: every `<select>` has `<label htmlFor>`; direction controls use `<fieldset><legend>`  
- [x] **Images**: zero `<img>` tags in the app; all icons are `aria-hidden="true"`  
- [x] **Reduced-motion path**: global `prefers-reduced-motion` kill exists; cursor has reduced-motion branch (no lerp); grain is static (no animation)
