import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FiActivity,
  FiArrowRight,
  FiClock,
  FiMapPin,
  FiNavigation,
} from 'react-icons/fi';
import BusMap from '../components/BusMap';
import {
  getDirections,
  getPatterns,
  getStops,
  getVehicles,
} from '../services/apiService';
import { ROUTE_CATALOG, getRouteMeta } from '../Data/routeCatalog';

function relativeTime(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

function Tracker() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRoute = String(searchParams.get('route') || 'OSW10').toUpperCase();
  const [routeId, setRouteId] = useState(
    ROUTE_CATALOG.some((route) => route.id === initialRoute)
      ? initialRoute
      : 'OSW10'
  );
  const [direction, setDirection] = useState(
    searchParams.get('direction') || ''
  );
  const [directions, setDirections] = useState([]);
  const [stops, setStops] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleMeta, setVehicleMeta] = useState(null);
  const [routeLoading, setRouteLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState('');
  const [vehicleMessage, setVehicleMessage] = useState('');
  const [now, setNow] = useState(Date.now());

  const route = useMemo(() => getRouteMeta(routeId), [routeId]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setRouteLoading(true);
    setMapError('');

    getDirections(routeId, { signal: controller.signal })
      .then((payload) => {
        const nextDirections = payload.directions || [];
        setDirections(nextDirections);
        setDirection((current) =>
          nextDirections.some((item) => item.id === current)
            ? current
            : nextDirections[0]?.id || ''
        );
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setDirections([]);
          setMapError(error.message);
        }
      })
      .finally(() => setRouteLoading(false));

    return () => controller.abort();
  }, [routeId]);

  useEffect(() => {
    const params = new URLSearchParams({ route: routeId });
    if (direction) params.set('direction', direction);
    setSearchParams(params, { replace: true });
  }, [direction, routeId, setSearchParams]);

  useEffect(() => {
    if (!routeId || !direction) {
      setStops([]);
      setPatterns([]);
      return undefined;
    }

    const controller = new AbortController();
    setMapLoading(true);
    setMapError('');

    Promise.all([
      getStops(routeId, direction, { signal: controller.signal }),
      getPatterns(routeId, direction, { signal: controller.signal }),
    ])
      .then(([stopsPayload, patternsPayload]) => {
        setStops(stopsPayload.stops || []);
        setPatterns(patternsPayload.patterns || []);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setStops([]);
          setPatterns([]);
          setMapError(error.message);
        }
      })
      .finally(() => setMapLoading(false));

    return () => controller.abort();
  }, [direction, routeId]);

  useEffect(() => {
    if (!routeId) return undefined;
    let active = true;
    let controller;

    const loadVehicles = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const payload = await getVehicles(routeId, {
          signal: controller.signal,
        });
        if (active) {
          setVehicles(payload.vehicles || []);
          setVehicleMeta(payload.meta || null);
          setVehicleMessage(payload.message || '');
        }
      } catch (error) {
        if (active && error.name !== 'AbortError') {
          setVehicles([]);
          setVehicleMessage(error.message);
        }
      }
    };

    loadVehicles();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadVehicles();
    }, 300_000);

    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [routeId]);

  const latestVehicleUpdate = vehicles
    .map((vehicle) => vehicle.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <main className="page map-page" id="main-content">
      <header className="page-heading page-heading--split">
        <div>
          <p className="eyebrow">
            <FiActivity aria-hidden="true" />
            Centro BusTime
          </p>
          <h1>Live map</h1>
          <p>
            Centro routes, stops, and reporting buses.
          </p>
        </div>
        <div className="map-legend" aria-label="Map legend">
          <span>
            <i className="legend-dot legend-dot--bus" />
            Live bus
          </span>
          <span>
            <i className="legend-dot legend-dot--stop" />
            Centro stop
          </span>
        </div>
      </header>

      <section className="map-toolbar" aria-label="Map controls">
        <div className="field field--compact">
          <label htmlFor="map-route">Route</label>
          <div className="select-shell">
            <select
              id="map-route"
              value={routeId}
              onChange={(event) => {
                setRouteId(event.target.value);
                setDirection('');
                setVehicles([]);
              }}
            >
              {ROUTE_CATALOG.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.id} · {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="direction-fieldset direction-fieldset--toolbar">
          <legend>Direction</legend>
          <div className="segmented-control">
            {routeLoading ? (
              <span className="skeleton skeleton--segment" />
            ) : (
              directions.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={direction === item.id}
                  className={direction === item.id ? 'is-active' : ''}
                  onClick={() => setDirection(item.id)}
                >
                  {item.name}
                </button>
              ))
            )}
          </div>
        </fieldset>
      </section>

      {mapError && (
        <div className="status-banner status-banner--error" role="alert">
          {mapError}
        </div>
      )}

      <section
        className="map-stage"
        style={{ '--route-color': route.color }}
        aria-label={`${route.id} ${direction} map`}
      >
        <div className="map-stage__topline">
          <div className="route-title route-title--compact">
            <span className="route-pill" data-long={route.shortName.length > 2 || undefined}>{route.shortName}</span>
            <div>
              <strong>{route.name}</strong>
              <span>{direction || 'Choose a direction'}</span>
            </div>
          </div>
          <div className="map-stats">
            <span>
              <FiMapPin aria-hidden="true" />
              <strong>{stops.length}</strong> stops
            </span>
            <span>
              <FiNavigation aria-hidden="true" />
              <strong>{vehicles.length}</strong>{' '}
              {vehicles.length === 1 ? 'bus' : 'buses'}
            </span>
            <span>
              <FiClock aria-hidden="true" />
              {relativeTime(latestVehicleUpdate || vehicleMeta?.serverTime)}
            </span>
          </div>
        </div>

        {mapLoading ? (
          <div className="map-placeholder" aria-label="Loading Centro route map">
            <span className="route-loader" />
            <p>Drawing {route.id} from Centro…</p>
          </div>
        ) : (
          <BusMap
            route={route}
            direction={direction}
            patterns={patterns}
            stops={stops}
            vehicles={vehicles}
          />
        )}

        {!mapLoading && vehicles.length === 0 && (
          <div className="map-service-note" role="status">
            <span className="live-dot live-dot--muted" aria-hidden="true" />
            {vehicleMessage || 'No live bus is reporting on this route right now.'}
            <Link to={`/route/${route.id}?direction=${encodeURIComponent(direction)}`}>
              Check arrivals
              <FiArrowRight aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

export default Tracker;
