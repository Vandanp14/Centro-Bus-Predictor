import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiArrowRight,
  FiChevronRight,
  FiClock,
  FiMapPin,
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
    <main className="page home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <motion.div
          className="home-hero__copy"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <p className="eyebrow">
            <span className="live-dot" aria-hidden="true" />
            Live in Oswego
          </p>
          <h1 id="home-title">
            Your bus is
            <span> already moving.</span>
          </h1>
          <p className="home-hero__lede">
            Find real Centro arrivals, route shapes, and bus locations across
            every current Oswego route.
          </p>

          <motion.div
            className="service-readout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.25 }}
          >
            <div>
              <FiClock aria-hidden="true" />
              <span>
                Local time
                <strong>{formatClock(now)}</strong>
              </span>
            </div>
            <div>
              <FiRadio aria-hidden="true" />
              <span>
                Data source
                <strong>
                  {routesPayload.meta?.live ? 'Centro BusTime' : 'Route catalog'}
                </strong>
              </span>
            </div>
          </motion.div>
        </motion.div>

        <div className="hero-viz" aria-hidden="true">
          <div className="hero-viz__scene">
            <div className="hero-viz__path" />
            <div className="hero-viz__stop" style={{ left: '20%', top: '30%' }} />
            <div className="hero-viz__stop" style={{ left: '55%', top: '50%' }} />
            <div className="hero-viz__stop" style={{ left: '35%', top: '70%' }} />
            <div className="hero-viz__stop" style={{ left: '75%', top: '25%' }} />
            <div className="hero-viz__bus" />
            <div className="hero-viz__bus hero-viz__bus--2" />
          </div>
        </div>

        <motion.form
          className="trip-planner"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
        >
          <div className="trip-planner__header">
            <div>
              <span className="utility-label">Find my bus</span>
              <h2>Where are you boarding?</h2>
            </div>
            <FiMapPin aria-hidden="true" />
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
            <label htmlFor="home-stop">Stop</label>
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

          <motion.button
            className="button button--primary button--full"
            type="submit"
            disabled={!canSubmit}
            whileTap={canSubmit ? { scale: 0.97 } : undefined}
            transition={{ duration: 0.12, ease: 'easeOut' }}
          >
            See live arrivals
            <FiArrowRight aria-hidden="true" />
          </motion.button>
        </motion.form>
      </section>

      {routesError && (
        <motion.div
          className="status-banner status-banner--warning"
          role="status"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          Live route verification is unavailable. The current Oswego catalog is
          still shown below.
        </motion.div>
      )}

      <motion.section
        className="network-section"
        aria-labelledby="network-title"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <header className="section-heading">
          <div>
            <p className="eyebrow">Current network</p>
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
            : routes.map((route, index) => (
                <motion.div
                  key={route.id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.06, ease: 'easeOut' }}
                >
                  <Link
                    className="route-row"
                    to={`/route/${route.id}`}
                    style={{ '--route-color': route.color }}
                  >
                  <span className="route-row__line" aria-hidden="true" />
                  <span className="route-pill">{route.shortName}</span>
                  <span className="route-row__copy">
                    <strong>{route.name}</strong>
                    <small>{route.category}</small>
                  </span>
                  <span className="route-row__action">
                    Arrivals
                    <FiChevronRight aria-hidden="true" />
                  </span>
                </Link>
                </motion.div>
              ))}
        </div>
      </motion.section>
    </main>
  );
}

export default Home;
