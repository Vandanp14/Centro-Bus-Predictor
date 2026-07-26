import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiAlertCircle,
  FiClock,
  FiRefreshCw,
  FiRadio,
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

function EmptyPanel({ icon: Icon = FiClock, title, children }) {
  return (
    <div className="arrival-empty">
      <span className="arrival-empty__icon">
        <Icon aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
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

  return (
    <section
      className="arrival-board"
      aria-labelledby="arrival-board-title"
      aria-live="polite"
    >
      <motion.header
        className="arrival-board__header"
        layout
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        <div>
          <p className="utility-label">Live arrivals</p>
          <h2 id="arrival-board-title">
            {stopName || 'Choose a stop'}
          </h2>
          {direction && <span>{direction}</span>}
        </div>
        <motion.button
          className="icon-button"
          type="button"
          onClick={onRefresh}
          disabled={!stopName || loading || refreshing}
          aria-label="Refresh live arrivals"
          title="Refresh live arrivals"
          whileTap={{ scale: 0.92 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
        >
          <FiRefreshCw
            aria-hidden="true"
            className={refreshing ? 'is-spinning' : ''}
          />
        </motion.button>
      </motion.header>

      <motion.div
        className="arrival-board__body"
        layout
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
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
          <EmptyPanel icon={FiClock} title="No upcoming prediction">
            {payload?.message ||
              'Centro is not reporting an upcoming bus for this stop.'}
          </EmptyPanel>
        ) : (
          <>
            <article className="next-arrival">
              <AnimatePresence mode="wait">
                <motion.div
                  className="next-arrival__countdown"
                  key={predictions[0].predictedAt || predictions[0].vehicleId || 'countdown'}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <strong>{countdownLabel(predictions[0])}</strong>
                  <span>{formatTime(predictions[0].predictedAt)}</span>
                </motion.div>
              </AnimatePresence>
              <div className="next-arrival__details">
                <span className="next-arrival__route">
                  <i
                    style={{ backgroundColor: route.color }}
                    aria-hidden="true"
                  />
                  {route.id} to {predictions[0].destination || 'destination'}
                </span>
                <h3>
                  {predictions[0].due
                    ? 'Move to the stop now'
                    : `Expected in ${predictions[0].minutes} ${
                        predictions[0].minutes === 1 ? 'minute' : 'minutes'
                      }`}
                </h3>
                <p>
                  Bus {predictions[0].vehicleId || 'assignment pending'}
                  {predictions[0].delayed && (
                    <span className="delay-label">Centro reports a delay</span>
                  )}
                </p>
              </div>
            </article>

            {predictions.length > 1 && (
              <motion.div
                className="following-arrivals"
                initial="hidden"
                animate="visible"
                variants={{
                  visible: { transition: { staggerChildren: 0.06 } },
                }}
              >
                <span className="utility-label">Following buses</span>
                {predictions.slice(1, 4).map((prediction, index) => (
                  <motion.div
                    className="following-arrival"
                    key={`${prediction.vehicleId || 'bus'}-${
                      prediction.predictedAt || index
                    }`}
                    variants={{
                      hidden: { opacity: 0, x: -8 },
                      visible: { opacity: 1, x: 0 },
                    }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  >
                    <span className="following-arrival__marker" aria-hidden="true" />
                    <span>
                      <strong>{countdownLabel(prediction)}</strong>
                      <small>{prediction.destination || direction}</small>
                    </span>
                    <time dateTime={prediction.predictedAt || undefined}>
                      {formatTime(prediction.predictedAt)}
                    </time>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </>
        )}
      </motion.div>

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
