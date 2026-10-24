import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiArrowRight,
  FiChevronRight,
  FiClock,
  FiRadio,
} from 'react-icons/fi';
import TripContext from '../TripContext';
import {
  getDirections,
  getRoutes,
  getStops,
} from '../services/apiService';
import { ROUTE_CATALOG } from '../Data/routeCatalog';

const formatClock = (date) =>
  new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

function Home() {
  const navigate = useNavigate();
  const { trip, setTrip } = useContext(TripContext);
  const [routesPayload, setRoutesPayload] = useState({
    routes: ROUTE_CATALOG,
    meta: { live: false },
  });
  const [routesLoading, setRoutesLoading] = useState(true);
  const [routesError, setRoutesError] = useState('');
  const [now, setNow] = useState(new Date());

  const [selection, setSelection] = useState({
    route: trip.route || '',
    direction: trip.direction || '',
    stop: trip.stop || '',
  });
  const [directions, setDirections] = useState([]);
  const [stops, setStops] = useState([]);
  const [directionsLoading, setDirectionsLoading] = useState(false);
  const [stopsLoading, setStopsLoading] = useState(false);
  const [plannerError, setPlannerError] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    getRoutes({ signal: controller.signal })
      .then((payload) => {
        setRoutesPayload(payload);
        if (!payload.meta?.live && payload.meta?.message) {
          setRoutesError(payload.meta.message);
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setRoutesError(error.message);
        }
      })
      .finally(() => setRoutesLoading(false));

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selection.route) {
      setDirections([]);
      setStops([]);
      return undefined;
    }

    const controller = new AbortController();
    setDirectionsLoading(true);
    setPlannerError('');

    getDirections(selection.route, { signal: controller.signal })
      .then((payload) => {
        const nextDirections = payload.directions || [];
        setDirections(nextDirections);
        setSelection((current) => {
          const isValid = nextDirections.some(
            (direction) => direction.id === current.direction
          );
          return {
            ...current,
            direction: isValid
              ? current.direction
              : nextDirections.length === 1
                ? nextDirections[0].id
                : '',
            stop: isValid ? current.stop : '',
          };
        });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setDirections([]);
          setPlannerError(error.message);
        }
      })
      .finally(() => setDirectionsLoading(false));

    return () => controller.abort();
  }, [selection.route]);

  useEffect(() => {
    if (!selection.route || !selection.direction) {
      setStops([]);
      return undefined;
    }

    const controller = new AbortController();
    setStopsLoading(true);
    setPlannerError('');

    getStops(selection.route, selection.direction, {
      signal: controller.signal,
    })
      .then((payload) => {
        const nextStops = payload.stops || [];
        setStops(nextStops);
        setSelection((current) => ({
          ...current,
          stop: nextStops.some((stop) => stop.id === current.stop)
            ? current.stop
            : '',
        }));
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setStops([]);
          setPlannerError(error.message);
        }
      })
      .finally(() => setStopsLoading(false));

    return () => controller.abort();
  }, [selection.route, selection.direction]);

  const routes = routesPayload.routes?.length
    ? routesPayload.routes
    : ROUTE_CATALOG;
  const selectedStop = stops.find((stop) => stop.id === selection.stop);
  const canSubmit =
    selection.route && selection.direction && selection.stop && !plannerError;

  const plannerStatus = useMemo(() => {
    if (!selection.route) return 'Start with a route';
    if (directionsLoading) return 'Loading route directions';
    if (!selection.direction) return 'Choose your direction';
    if (stopsLoading) return 'Loading Centro stops';
    if (!selection.stop) return 'Choose where you are boarding';
    return 'Ready for live arrivals';
  }, [
    selection.route,
    selection.direction,
    selection.stop,
    directionsLoading,
    stopsLoading,
  ]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    setTrip({
      route: selection.route,
      direction: selection.direction,
      stop: selection.stop,
      stopName: selectedStop?.name || '',
    });

    const query = new URLSearchParams({
      direction: selection.direction,
      stop: selection.stop,
    });
    navigate(`/route/${selection.route}?${query.toString()}`);
  };

  return (
    <main className="page home-page" id="main-content">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__header">
          <p className="eyebrow">
            Oswego, New York
          </p>
          <h1 id="home-title">Your next bus.</h1>
          <p className="home-hero__lede">
            Live arrivals for campus, the city, and beyond.
          </p>
        </div>
      </section>
      <div className="home-workspace">
        <div className="home-planner-column">
        <form
          className="trip-planner"
          onSubmit={handleSubmit}
        >
          <div className="trip-planner__header">
            <h2>Where are you boarding?</h2>
            <span className="planner-source">
              <span className={`live-dot ${routesPayload.meta?.live ? '' : 'live-dot--muted'}`} aria-hidden="true" />
              {routesPayload.meta?.live ? 'BusTime' : 'Catalog'}
            </span>
          </div>

          <div className="field">
            <label htmlFor="home-route">Route</label>
            <div className="select-shell">
              <select
                id="home-route"
                value={selection.route}
                onChange={(event) =>
                  setSelection({
                    route: event.target.value,
                    direction: '',
                    stop: '',
                  })
                }
              >
                <option value="">Choose a route</option>
                {routes.map((route) => (
                  <option key={route.id} value={route.id}>
                    {route.id} · {route.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="home-direction">Direction</label>
            <div className="select-shell">
              <select
                id="home-direction"
                value={selection.direction}
                disabled={!selection.route || directionsLoading}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    direction: event.target.value,
                    stop: '',
                  }))
                }
              >
                <option value="">
                  {directionsLoading ? 'Loading directions…' : 'Choose direction'}
                </option>
                {directions.map((direction) => (
                  <option key={direction.id} value={direction.id}>
                    {direction.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label htmlFor="home-stop">Boarding stop</label>
            <div className="select-shell">
              <select
                id="home-stop"
                value={selection.stop}
                disabled={!selection.direction || stopsLoading}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    stop: event.target.value,
                  }))
                }
              >
                <option value="">
                  {stopsLoading ? 'Loading stops…' : 'Choose your stop'}
                </option>
                {stops.map((stop) => (
                  <option key={stop.id} value={stop.id}>
                    {stop.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {plannerError ? (
            <p className="form-message form-message--error">{plannerError}</p>
          ) : (
            <p className="form-message">{plannerStatus}</p>
          )}

          <button
            className="button button--primary button--full"
            type="submit"
            disabled={!canSubmit}
          >
            See live arrivals
            <FiArrowRight aria-hidden="true" />
          </button>
        </form>
        <div className="service-readout">
          <span><FiClock aria-hidden="true" /> {formatClock(now)} local time</span>
          <span><FiRadio aria-hidden="true" /> {routesPayload.meta?.live ? 'Centro BusTime' : 'Route catalog'}</span>
        </div>
        </div>
        <div className="home-network">
      {routesError && (
        <div
          className="status-banner status-banner--warning"
          role="status"
        >
          Live route verification is unavailable. The current Oswego catalog is
          still shown below.
        </div>
      )}

      <section
        className="network-section"
        aria-labelledby="network-title"
      >
        <header className="section-heading">
          <div>
            <h2 id="network-title">Oswego routes</h2>
          </div>
          <span>
            {routesLoading ? 'Checking Centro…' : `${routes.length} routes`}
          </span>
        </header>

        <div className="route-board">
          {routesLoading
            ? Array.from({ length: 4 }, (_, index) => (
                <div className="route-row route-row--loading" key={index}>
                  <span className="skeleton skeleton--route" />
                  <span className="skeleton skeleton--text" />
                </div>
              ))
            : routes.map((route) => (
                <Link
                  key={route.id}
                  className="route-row"
                  to={`/route/${route.id}`}
                  style={{ '--route-color': route.color }}
                >
                  <span className="route-pill" data-long={route.shortName.length > 2 || undefined}>{route.shortName}</span>
                  <span className="route-row__copy">
                    <strong>{route.name}</strong>
                    <small>{route.category}</small>
                  </span>
                  <span className="route-row__action">
                    Arrivals
                    <FiChevronRight aria-hidden="true" />
                  </span>
                </Link>
              ))}
        </div>
      </section>
        </div>
      </div>
    </main>
  );
}

export default Home;
