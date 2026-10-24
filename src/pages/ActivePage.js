import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiActivity,
  FiArrowRight,
  FiClock,
  FiNavigation,
} from 'react-icons/fi';
import { getAllVehicles } from '../services/apiService';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function headingLabel(deg) {
  if (deg == null) return '';
  return COMPASS[Math.round(deg / 45) % 8];
}

function formatSpeed(speed) {
  if (speed == null) return '';
  return `${Math.round(speed)} mph`;
}

function relativeTime(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

function ActivePage() {
  const [state, setState] = useState({
    vehicles: [],
    loading: true,
    error: '',
    message: '',
  });

  useEffect(() => {
    let active = true;
    let controller;

    const load = async (quiet = false) => {
      controller?.abort();
      controller = new AbortController();
      if (!quiet) {
        setState((prev) => ({ ...prev, loading: !prev.vehicles.length, error: '' }));
      }
      try {
        const payload = await getAllVehicles({ signal: controller.signal });
        if (active) {
          setState({
            vehicles: payload.vehicles || [],
            loading: false,
            error: '',
            message: payload.message || '',
          });
        }
      } catch (error) {
        if (active && error.name !== 'AbortError') {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: error.message || 'Failed to load active buses',
          }));
        }
      }
    };

    load(false);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, 300_000);

    return () => {
      active = false;
      controller?.abort();
      clearInterval(interval);
    };
  }, []);

  const { vehicles, loading, error, message } = state;

  const groups = {};
  for (const v of vehicles) {
    if (!groups[v.routeId]) groups[v.routeId] = [];
    groups[v.routeId].push(v);
  }
  const routeIds = Object.keys(groups).sort();

  return (
    <main className="page active-page" id="main-content">
      <header className="page-heading">
        <p className="eyebrow">
          <FiActivity aria-hidden="true" />
          Centro BusTime
        </p>
        <h1>Active buses</h1>
        <p>
          All Centro vehicles currently reporting across Oswego routes.
        </p>
      </header>

      {loading && (
        <div className="active-loading">
          {Array.from({ length: 3 }, (_, i) => (
            <div className="skeleton skeleton--active-card" key={i} />
          ))}
        </div>
      )}

      {error && (
        <div className="status-banner status-banner--error" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && vehicles.length === 0 && (
        <div className="active-empty" role="status">
          <FiNavigation aria-hidden="true" />
          <h2>No active buses</h2>
          <p>{message || 'No Centro vehicles are reporting right now.'}</p>
          <p className="active-empty__hint">
            Buses appear here when they begin reporting their position.
          </p>
        </div>
      )}

      {routeIds.map((routeId) => (
        <section className="active-route-group" key={routeId}>
          <header className="active-route-header">
            <div>
              <span
                className="route-pill"
                style={{ '--route-color': groups[routeId][0].color }}
                data-long={(groups[routeId][0].shortName || routeId).length > 2 || undefined}
              >
                {groups[routeId][0].shortName || routeId}
              </span>
              <div>
                <strong>{groups[routeId][0].destination || routeId}</strong>
                <span>
                  {groups[routeId].length} {groups[routeId].length === 1 ? 'bus' : 'buses'}
                </span>
              </div>
            </div>
            <Link
              className="button button--ghost"
              to={`/route/${routeId}`}
            >
              Arrivals
              <FiArrowRight aria-hidden="true" />
            </Link>
          </header>

          <div className="active-vehicle-list">
            {groups[routeId].map((vehicle) => (
              <article className="active-vehicle" key={vehicle.id} aria-label={`Bus ${vehicle.id}`}>
                <div className="active-vehicle__head">
                  <span className="active-vehicle__id">Bus {vehicle.id}</span>
                  <span className={`active-vehicle__status ${vehicle.delayed ? 'is-delayed' : 'is-ontime'}`}>
                    {vehicle.delayed ? 'Delayed' : 'On time'}
                  </span>
                </div>
                <div className="active-vehicle__stats">
                  <span>
                    <b>{formatSpeed(vehicle.speed)}</b>
                    <small>Speed</small>
                  </span>
                  <span>
                    <b>{headingLabel(vehicle.heading)}</b>
                    <small>{vehicle.heading}°</small>
                  </span>
                  <span>
                    <b>{vehicle.direction || '\u2014'}</b>
                    <small>Direction</small>
                  </span>
                  <span>
                    <b>{relativeTime(vehicle.updatedAt)}</b>
                    <small>Updated</small>
                  </span>
                </div>
                <Link
                  className="active-vehicle__map-link"
                  to={`/tracker?route=${vehicle.routeId}&direction=${encodeURIComponent(vehicle.direction || '')}`}
                >
                  Show on map
                  <FiArrowRight aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </section>
      ))}

      {!loading && !error && vehicles.length > 0 && (
        <footer className="active-footer">
          <FiActivity aria-hidden="true" />
          <span>{vehicles.length} active {vehicles.length === 1 ? 'bus' : 'buses'} across {routeIds.length} {routeIds.length === 1 ? 'route' : 'routes'}</span>
          <FiClock aria-hidden="true" />
          <span>Updates every 5 min</span>
        </footer>
      )}
    </main>
  );
}

export default ActivePage;
