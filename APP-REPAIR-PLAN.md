# Centro Bus Predictor — App Repair Plan

## Status Overview

| Layer | Status | URL |
|-------|--------|-----|
| Backend API (Flask) | ✅ Running | `http://pi.cs.oswego.edu:5001` |
| Frontend (React SPA) | ⚡ Served via Flask | Same as above |
| Data Collector (Agent) | ✅ Running (polling 60s) | `pi.cs.oswego.edu` |

---

## ✅ Completed

### Phase 1 — Fix backend endpoints
- [x] `GET /routes` — returns route list from DB (6 routes)
- [x] `GET /stops?route=X&direction=Y` — returns stops, filters by direction
- [x] `GET /directions?route=X` — returns real `rtdir` values with stops
- [x] `GET /prediction?route=X&stop=Y&direction=Z` — direction-filtered predictions
- [x] `GET /avgPrediction` — direction-filtered historical averages
- [x] `GET /schedule?route=X` — schedule grid data
- [x] `GET /graphanalysis?route=X&direction=Y` — aggregate stats

### Phase 2 — Fix frontend data flow
- [x] `FilterBar.js` — fetches real directions/stops from API
- [x] `RouteDetail.js` — uses real directions/stops from API, no midpoint split
- [x] `Home.js` — calls `/routes` API, fetches directions per route, direction-aware predictions
- [x] `apiService.js` — all functions pass direction, consistent error handling
- [x] Secrets moved to `.env` (DB creds, API keys)

### Phase 3 — Bug fixes
- [x] Direction dropdown empty (FilterBar) — was missing `directions` field
- [x] Duplicate route ID in Schedule.js — OSW10 listed twice instead of OSW11
- [x] Broken hero image — `url('/images/bus-hero.jpg')` didn't exist
- [x] Orphaned `AND` in SQL in `get_latest_7_avg_prediction`
- [x] `agent.py` auth failure — switched from `mysql.connector` to `pymysql`

### Phase 4 — Infrastructure
- [x] Backend moved to port 5001 (AirTunes conflicts on 5000)
- [x] Frontend served via Flask on port 5001 (single-port deployment)
- [x] `.env` for both frontend and backend
- [x] `deploy.sh` — automated deployment script
- [x] `public/index.html` title: "React App" → "Centro Bus Predictor"
- [x] API accessible externally at `http://pi.cs.oswego.edu:5001`

---

## ❌ Remaining

### High Priority
- [ ] **SSH key setup** — `deploy.sh` installs one, but it hasn't been run fully. Without it, every SSH/scp command prompts for password.
- [ ] **Process persistence** — If the server reboots, Flask + agent won't restart automatically. Needs a cron job or systemd user service.

### Medium Priority
- [ ] **Remove unused dependencies** — `axios`, `recharts` in package.json (not used anywhere)
- [ ] **Remove unused components** — `src/components/MapView.js`, `src/components/HeroSection.js`
- [ ] **Remove ghost `.gitmodules`** — references nonexistent submodule
- [ ] **Remove unused public assets** — `logo192.png`, `logo512.png`, `manifest.json` (CRA defaults)
- [ ] **Fix `backend/src/main/test/`** — skeleton contains `assertEqual(True, False)` (always fails)

### Low Priority
- [ ] **Error boundaries** — all API errors logged to console only, no user-facing fallbacks
- [ ] **Loading states** — some pages show no spinner/skeleton while loading
- [ ] **Responsive layout** — basic but could be improved
- [ ] **TypeScript migration** — all JS, no types
- [ ] **CRA → Vite migration** — CRA is unmaintained, but Node 12 on server prevents building there (build locally)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  pi.cs.oswego.edu (port 5001)                          │
│                                                         │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Flask    │───▶│  PyMySQL     │───▶│  MySQL (DB)  │  │
│  │  app.py   │    │              │    │              │  │
│  │           │    │              │    │  Routes      │  │
│  │  /routes  │    │              │    │  Stops       │  │
│  │  /stops   │    │              │    │  ETA (1.3M)  │  │
│  │  /pred... │    │              │    │  Weather     │  │
│  │  + static │    │              │    └──────┬───────┘  │
│  └─────┬─────┘    └──────────────┘           │          │
│        │                                     │          │
│        │  ┌──────────────┐                    │          │
│        │  │  Agent       │───────────────────┘          │
│        │  │  agent.py    │  polls Centro API            │
│        │  │  (60s loop)  │  inserts predictions         │
│        │  └──────────────┘                               │
│        │                                                 │
│  ┌─────┴─────────────────────────────────────────┐       │
│  │  Frontend (React build, served as static)      │       │
│  │  / → index.html  │  /route/:id → index.html   │       │
│  └───────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

## How to Restart Everything

```bash
ssh vpatel4@pi.cs.oswego.edu

# Kill existing
pkill -f app.py; pkill -f agent.py

# Start API
cd ~/centro-bus-predictor
nohup python3 backend/src/main/app.py > /tmp/centro-api.log 2>&1 &

# Start agent collector
nohup python3 backend/src/main/agent.py > /tmp/centro-agent.log 2>&1 &

# Verify
curl http://localhost:5001/routes
curl http://localhost:5001
```

## How to Update Frontend

```bash
# On Mac (build locally with modern Node)
cd ~/Documents/Centro-Bus-Predictor
npm run build

# Copy build to server
scp -r build/ vpatel4@pi.cs.oswego.edu:~/centro-bus-predictor/build/

# Restart Flask (it picks up new static files)
ssh vpatel4@pi.cs.oswego.edu "pkill -f app.py && cd ~/centro-bus-predictor && nohup python3 backend/src/main/app.py > /tmp/centro-api.log 2>&1 &"
```
