import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiArrowUpRight,
  FiClock,
  FiMap,
  FiMapPin,
} from 'react-icons/fi';
import TripContext from '../TripContext';
import NextBusCard from '../components/NextBusCard';
import {
  getDirections,
  getPredictions,
  getStops,
} from '../services/apiService';
import { getRouteMeta } from '../Data/routeCatalog';

function RouteDetail() {
  const { routeId: routeParam } = useParams();
  const routeId = String(routeParam || '').toUpperCase();
  const route = useMemo(() => getRouteMeta(routeId), [routeId]);
  const [searchParams, setSearchParams] = useSearchParams();
  const { trip, setTrip } = useContext(TripContext);

  const initialDirection =
    searchParams.get('direction') ||
    (trip.route === routeId ? trip.direction : '') ||
    '';
  const initialStop =
    searchParams.get('stop') || (trip.route === routeId ? trip.stop : '') || '';

  const [direction, setDirection] = useState(initialDirection);
  const [stopId, setStopId] = useState(initialStop);
  const [directions, setDirections] = useState([]);
  const [stops, setStops] = useState([]);
  const [directionsLoading, setDirectionsLoading] = useState(true);
  const [stopsLoading, setStopsLoading] = useState(false);
  const [selectionError, setSelectionError] = useState('');

  const [predictionState, setPredictionState] = useState({
    payload: null,
    loading: false,
    refreshing: false,
    error: '',
  });
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setDirectionsLoading(true);
    setSelectionError('');

    getDirections(routeId, { signal: controller.signal })
      .then((payload) => {
        const nextDirections = payload.directions || [];
        setDirections(nextDirections);
        setDirection((current) => {
          if (nextDirections.some((item) => item.id === current)) return current;
          return nextDirections[0]?.id || '';
        });
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setDirections([]);
          setSelectionError(error.message);
        }
      })
      .finally(() => setDirectionsLoading(false));

    return () => controller.abort();
  }, [routeId]);

  useEffect(() => {
    if (!routeId || !direction) {
      setStops([]);
      return undefined;
    }

    const controller = new AbortController();
    setStopsLoading(true);
    setSelectionError('');

    getStops(routeId, direction, { signal: controller.signal })
      .then((payload) => {
        const nextStops = payload.stops || [];
        setStops(nextStops);
        setStopId((current) =>
          nextStops.some((stop) => stop.id === current) ? current : ''
        );
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setStops([]);
          setSelectionError(error.message);
        }
      })
      .finally(() => setStopsLoading(false));

    return () => controller.abort();
  }, [routeId, direction]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (direction) params.set('direction', direction);
    if (stopId) params.set('stop', stopId);
    setSearchParams(params, { replace: true });

    const stopName =
      stops.find((stop) => String(stop.id) === String(stopId))?.name || '';
    setTrip({ route: routeId, direction, stop: stopId, stopName });
  }, [direction, routeId, setSearchParams, setTrip, stopId, stops]);

  useEffect(() => {
    if (!routeId || !direction || !stopId) {
      setPredictionState({
        payload: null,
        loading: false,
        refreshing: false,
        error: '',
      });
      return undefined;
    }

    let active = true;
    let controller;

    const load = async (quiet = false) => {
      controller?.abort();
      controller = new AbortController();
      setPredictionState((current) => ({
        ...current,
        loading: !quiet && !current.payload,
        refreshing: quiet || Boolean(current.payload),
        error: '',
      }));

      try {
        const payload = await getPredictions(routeId, stopId, direction, {
          signal: controller.signal,
        });
        if (active) {
          setPredictionState({
            payload,
            loading: false,
            refreshing: false,
            error: '',
          });
        }
      } catch (error) {
        if (active && error.name !== 'AbortError') {
          setPredictionState((current) => ({
            ...current,
            loading: false,
            refreshing: false,
            error: error.message,
          }));
        }
      }
    };

    load(false);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load(true);
    }, 30_000);

    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [direction, refreshNonce, routeId, stopId]);

  const stopName =
    stops.find((stop) => String(stop.id) === String(stopId))?.name ||
    (trip.route === routeId && trip.stop === stopId ? trip.stopName : '');

  return (
    <main className="page route-page">
      <Link className="back-link" to="/">
        <FiArrowLeft aria-hidden="true" />
        All Oswego routes
      </Link>

      <header
        className="route-page__header"
        style={{ '--route-color': route.color }}
      >
        <div className="route-title">
          <span className="route-pill route-pill--large">{route.shortName}</span>
          <div>
            <p className="eyebrow">{route.category}</p>
            <h1>{route.name}</h1>
          </div>
        </div>
        <div className="route-header-actions">
          <Link
            className="button button--secondary"
            to={`/tracker?route=${route.id}${
              direction ? `&direction=${encodeURIComponent(direction)}` : ''
            }`}
          >
            <FiMap aria-hidden="true" />
            Route map
          </Link>
          <a
            className="button button--ghost"
            href={route.scheduleUrl}
            target="_blank"
            rel="noreferrer"
          >
            <FiClock aria-hidden="true" />
            Official schedule
            <FiArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </header>

      {selectionError && (
        <div className="status-banner status-banner--error" role="alert">
          {selectionError}
        </div>
      )}

      <div className="route-workspace">
        <section className="stop-selector" aria-labelledby="stop-selector-title">
          <header>
            <span className="stop-selector__index">01</span>
            <div>
              <p className="utility-label">Trip setup</p>
              <h2 id="stop-selector-title">Choose your stop</h2>
            </div>
          </header>

          <fieldset className="direction-fieldset">
            <legend>Direction</legend>
            <div className="segmented-control">
              {directionsLoading ? (
                <>
                  <span className="skeleton skeleton--segment" />
                  <span className="skeleton skeleton--segment" />
                </>
              ) : (
                directions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={direction === item.id ? 'is-active' : ''}
                    onClick={() => {
                      setDirection(item.id);
                      setStopId('');
                    }}
                  >
                    {item.name}
                  </button>
                ))
              )}
            </div>
          </fieldset>

          <div className="field">
            <label htmlFor="route-stop">Boarding stop</label>
            <div className="select-shell select-shell--map">
              <FiMapPin aria-hidden="true" />
              <select
                id="route-stop"
                value={stopId}
                disabled={!direction || stopsLoading}
                onChange={(event) => setStopId(event.target.value)}
              >
                <option value="">
                  {stopsLoading ? 'Loading Centro stops…' : 'Choose a stop'}
                </option>
                {stops.map((stop) => (
                  <option key={stop.id} value={stop.id}>
                    {stop.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="selector-note">
            <span className="live-dot" aria-hidden="true" />
            Arrivals refresh every 30 seconds while this page is open.
          </div>
        </section>

        <NextBusCard
          route={route}
          stopName={stopName}
          direction={direction}
          payload={predictionState.payload}
          loading={predictionState.loading}
          refreshing={predictionState.refreshing}
          error={predictionState.error}
          onRefresh={() => setRefreshNonce((value) => value + 1)}
        />
      </div>
    </main>
  );
}

export default RouteDetail;
