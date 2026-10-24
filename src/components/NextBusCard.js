import React from 'react';
import { Link } from 'react-router-dom';
import {
  FiAlertCircle,
  FiClock,
  FiRefreshCw,
  FiRadio,
  FiArrowRight,
  FiArrowUpRight,
  FiMoon,
} from 'react-icons/fi';

const formatTime = (value) => {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const relativeUpdate = (value) => {
  if (!value) return 'just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'just now';
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
};

const countdownLabel = (prediction) => {
  if (prediction.due || prediction.minutes === 0) return 'Due';
  if (prediction.minutes === 1) return '1 min';
  if (prediction.minutes != null) return `${prediction.minutes} min`;
  return formatTime(prediction.predictedAt);
};

function EmptyPanel({ icon: Icon = FiClock, title, children, action }) {
  return (
    <div className="arrival-empty">
      <span className="arrival-empty__icon">
        <Icon aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}

// Centro only predicts about 45 minutes ahead, so an empty list can mean
// "bus is coming later" (beyond_window) or "nothing is running" (no_service).
const EMPTY_STATES = {
  beyond_window: { icon: FiClock, title: 'Bus on the route, no time yet' },
  no_service: { icon: FiMoon, title: 'No bus running right now' },
};

function ScheduleLink({ url }) {
  if (!url) return null;
  return (
    <a className="text-link" href={url} target="_blank" rel="noreferrer">
      Check the official schedule
      <FiArrowUpRight aria-hidden="true" />
    </a>
  );
}

function NextBusCard({
  route,
  stopName,
  direction,
  payload,
  loading,
  refreshing,
  error,
  onRefresh,
}) {
  const predictions = payload?.predictions || [];
  const next = predictions[0];
  const due = Boolean(next && (next.due || next.minutes === 0));
  const hasMinutes = typeof next?.minutes === 'number' && Number.isFinite(next.minutes);

  return (
    <section
      className="arrival-board"
      aria-labelledby="arrival-board-title"
      aria-live="polite"
    >
      <header className="arrival-board__header">
        <div>
          <p className="utility-label">Boarding at</p>
          <h2 id="arrival-board-title">
            {stopName || 'Choose a stop'}
          </h2>
          {direction && <span>{direction}</span>}
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={onRefresh}
          disabled={!stopName || loading || refreshing}
          aria-label="Refresh live arrivals"
          title="Refresh live arrivals"
        >
          <FiRefreshCw
            aria-hidden="true"
            className={refreshing ? 'is-spinning' : ''}
          />
        </button>
      </header>

      <div className="arrival-board__body">
        {!stopName ? (
          <EmptyPanel title="Pick where you are boarding">
            Choose a direction and Centro stop to see the next buses.
          </EmptyPanel>
        ) : loading ? (
          <div className="arrival-loading" aria-label="Loading live arrivals">
            <span className="skeleton skeleton--countdown" />
            <span className="skeleton skeleton--arrival-line" />
            <span className="skeleton skeleton--arrival-line short" />
          </div>
        ) : error ? (
          <EmptyPanel icon={FiAlertCircle} title="Live arrivals did not load">
            {error}
          </EmptyPanel>
        ) : predictions.length === 0 ? (
          <EmptyPanel
            icon={EMPTY_STATES[payload?.status]?.icon || FiClock}
            title={EMPTY_STATES[payload?.status]?.title || 'No upcoming prediction'}
            action={<ScheduleLink url={route?.scheduleUrl} />}
          >
            {payload?.message ||
              'Centro is not reporting an upcoming bus for this stop.'}
          </EmptyPanel>
        ) : (
          <>
            <article className="next-arrival">
              <div className="next-arrival__heading">
                <span>Next bus</span>
                <span>{payload?.meta?.stale ? 'Stale estimate' : 'Centro estimate'}</span>
              </div>
              <div className={`next-arrival__countdown ${!due && !hasMinutes ? 'next-arrival__countdown--time' : ''}`} role="group" aria-label="Next bus arrival">
                <strong>{due ? 'Due' : hasMinutes ? next.minutes : formatTime(next.predictedAt)}</strong>
                {!due && hasMinutes && <span>min</span>}
              </div>
              <div className="next-arrival__details">
                <span className="next-arrival__route">
                  <i
                    style={{ backgroundColor: route.color }}
                    aria-hidden="true"
                  />
                  {route.id} to {predictions[0].destination || 'destination'}
                </span>
                <h3>
                  {due
                    ? 'Move to the stop now'
                    : hasMinutes ? `Expected at ${formatTime(next.predictedAt)}` : 'Expected arrival time'}
                </h3>
                <p>
                  Bus {predictions[0].vehicleId || 'assignment pending'}
                  {predictions[0].delayed && (
                    <span className="delay-label">Centro reports a delay</span>
                  )}
                </p>
              </div>
              <Link className="button button--primary button--full" to={`/tracker?route=${route.id}&direction=${encodeURIComponent(direction || '')}`}>
                View route map
                <FiArrowRight aria-hidden="true" />
              </Link>
            </article>

            {predictions.length > 1 && (
              <div className="following-arrivals">
                <span className="utility-label">Following buses</span>
                {predictions.slice(1, 4).map((prediction) => (
                  <div
                    className="following-arrival"
                    key={`${prediction.vehicleId || 'bus'}-${prediction.predictedAt || ''}`}
                  >
                    <span className="following-arrival__marker" aria-hidden="true" />
                    <span>
                      <strong>{countdownLabel(prediction)}</strong>
                      <small>{prediction.destination || direction}</small>
                    </span>
                    <time dateTime={prediction.predictedAt || undefined}>
                      {formatTime(prediction.predictedAt)}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <footer className="arrival-board__footer">
        <span>
          <FiRadio aria-hidden="true" />
          {payload?.meta?.stale ? 'Stale Centro update' : 'Centro BusTime'}
        </span>
        <span>
          Updated {relativeUpdate(payload?.meta?.sourceTime)}
        </span>
      </footer>
    </section>
  );
}

export default NextBusCard;
