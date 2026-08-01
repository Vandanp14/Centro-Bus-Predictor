# Centro Oswego Live

**Live deployment**: [pi.cs.oswego.edu:5001](http://pi.cs.oswego.edu:5001)

A focused live-arrivals and route-map app for Centro service in Oswego, New
York. The React client uses a Flask proxy so Centro credentials stay on the
server.

## Deploying

```bash
bash deploy.sh
```

The script builds the frontend, packages everything, copies it to the server,
installs dependencies, and restarts the Flask server. You'll need the SSH
password for `vpatel4@pi.cs.oswego.edu`.

## What the app provides

- The current Oswego route catalog from Centro BusTime
- Route-provided directions and stop coordinates
- Multiple upcoming predictions for a selected stop
- Prediction timestamp and stale-data signaling
- Centro route geometry and live vehicle positions
- Direct links to official Centro schedules and service alerts
- Explicit loading, no-service, offline, and error states

The UI intentionally does not label a prediction snapshot as a schedule or
claim that static stop markers are live buses.

## Centro BusTime contract

Centro uses the Clever Devices BusTime v3 API. The server consumes:

- `getroutes`
- `getdirections`
- `getstops`
- `getpredictions`
- `getpatterns`
- `getvehicles`

The app currently presents the Oswego routes returned by Centro: OSW09, OSW10,
OSW11, OSW17, OSW18, OSW19, and OSW46. Retired OSW1A and OSW2A placeholders
were removed.

Useful references:

- [Centro BusTracker](https://bus-time.centro.org/bustime/home.jsp)
- [Centro routes and schedules](https://www.centro.org/routes-schedules)
- [BusTime v3 field reference](https://www.transitchicago.com/assets/1/6/cta_Bus_Tracker_API_Developer_Guide_and_Documentation_2025-04-21.pdf)

## Local setup

Requirements:

- Node.js 18+
- Python 3.11+
- A Centro BusTime API key

Create local environment files from the safe templates:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

Set `CENTRO_API_KEY` in `backend/.env`. Database values are only required when
running the optional historical collector.

Install and start the API:

```bash
python3 -m pip install -r requirements.txt
python3 backend/src/main/app.py
```

In another terminal, start the React client:

```bash
npm install
npm start
```

The frontend defaults to `REACT_APP_API_BASE_URL`. In production, leave the
value empty and serve the built React app from Flask for same-origin requests.

## API

All application endpoints live under `/api/v1`:

- `GET /api/v1/health`
- `GET /api/v1/routes`
- `GET /api/v1/routes/:routeId/directions`
- `GET /api/v1/routes/:routeId/stops?direction=...`
- `GET /api/v1/predictions?route=...&direction=...&stop=...`
- `GET /api/v1/routes/:routeId/patterns?direction=...`
- `GET /api/v1/routes/:routeId/vehicles`

Centro “No service scheduled” and “no live vehicle” responses become
successful empty states. Dependency failures use one safe JSON error shape with
a request ID.

## Verification

```bash
npm run build
CI=true npm run test:ci
python3 -m unittest discover -s backend/src/test -p 'test*.py' -v
python3 -m py_compile backend/src/main/app.py backend/src/main/agent.py
```

Tests use deterministic fixtures and do not require Centro, MySQL, or weather
network access.

## Optional historical collector

`backend/src/main/agent.py` discovers current directions and stops from Centro,
batches prediction requests, and stores snapshots in MySQL once per minute
during its configured collection window. It is not required for the live web
experience.

Credentials must remain in environment configuration. Never place a Centro key,
database password, or third-party API key in source code or the browser bundle.
