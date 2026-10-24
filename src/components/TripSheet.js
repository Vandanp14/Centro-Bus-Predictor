import React, { useEffect, useRef } from 'react';
import {
  FiAlertCircle,
  FiArrowUpRight,
  FiChevronUp,
  FiClock,
  FiMoon,
  FiRadio,
  FiRefreshCw,
} from 'react-icons/fi';
import { formatTime, relativeUpdate } from '../utils/time';

// Centro only predicts about 45 minutes ahead, so an empty prediction can
// mean "bus is coming later" (beyond_window) or "nothing is running".
const EMPTY_STATES = {
  beyond_window: { icon: FiClock, title: 'Bus on the route, no time yet' },
  no_service: { icon: FiMoon, title: 'No bus running right now' },
  unknown: { icon: FiClock, title: 'No upcoming prediction' },
};

const stopsAwayLabel = (count) => `${count} ${count === 1 ? 'stop' : 'stops'} away`;

const stopTime = (stop) => {
  if (stop.due) return 'Due';
  if (typeof stop.minutes === 'number') return `${stop.minutes} min`;
  if (stop.state === 'passed') return '';
  return 'no time yet';
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

function SheetMessage({ icon: Icon, title, children, action }) {
  return (
    <div className="trip-sheet__message">
      <span className="arrival-empty__icon">
        <Icon aria-hidden="true" />
      </span>
      <div>
        <h3>{title}</h3>
        {children}
        {action}
      </div>
    </div>
  );
}

function Countdown({ bus }) {
  const hasMinutes = typeof bus.minutes === 'number';
  return (
    <div className="trip-countdown">
      <div className="trip-countdown__time" role="group" aria-label="Next bus arrival">
        <strong>{bus.due ? 'Due' : hasMinutes ? bus.minutes : formatTime(bus.predictedAt)}</strong>
        {!bus.due && hasMinutes && <span>min</span>}
      </div>
      {typeof bus.stopsAway === 'number' && (
        <div className="trip-countdown__away" role="group" aria-label={stopsAwayLabel(bus.stopsAway)}>
          <strong>{bus.stopsAway}</strong>
          <span>{bus.stopsAway === 1 ? 'stop away' : 'stops away'}</span>
        </div>
      )}
    </div>
  );
}

function Summary({ route, trip, loading, error }) {
  if (loading) {
    return (
      <div className="arrival-loading" aria-label="Loading live arrivals">
        <span className="skeleton skeleton--countdown" />
        <span className="skeleton skeleton--arrival-line" />
      </div>
    );
  }
  if (error) {
    return (
      <SheetMessage icon={FiAlertCircle} title="Live arrivals did not load">
        <p>{error}</p>
      </SheetMessage>
    );
  }
  if (!trip) return null;

  const { bus } = trip;
  if (trip.status !== 'live' || !bus) {
    const state = EMPTY_STATES[trip.status] || EMPTY_STATES.unknown;
    return (
      <SheetMessage icon={state.icon} title={state.title} action={<ScheduleLink url={route.scheduleUrl} />}>
        {bus && typeof bus.stopsAway === 'number' && (
          <p className="trip-sheet__away">{`${stopsAwayLabel(bus.stopsAway)} · no time yet`}</p>
        )}
        {trip.message && <p>{trip.message}</p>}
      </SheetMessage>
    );
  }

  return (
    <>
      <Countdown bus={bus} />
      <div className="trip-sheet__chips">
        <span className="chip">{`Bus ${bus.id}`}</span>
        {bus.predictedAt && <span className="chip">{`Arrives ${formatTime(bus.predictedAt)}`}</span>}
        {bus.delayed && <span className="delay-label">Centro reports a delay</span>}
      </div>
    </>
  );
}

function BusRow({ bus }) {
  return (
    <li className="trip-stops__bus">
      <span aria-hidden="true" className="trip-stops__bus-dot" />
      <span>
        {`Bus ${bus.id} is here`}
        {bus.destination && <small>{bus.destination}</small>}
      </span>
    </li>
  );
}

function StopList({ trip, boardingRef }) {
  const { stops = [], bus, busAfterStopId } = trip;
  if (!stops.length) return null;

  const rows = [];
  // Draw the bus only where the server placed it; an unknown position is
  // left out rather than shown at the start of the route.
  if (bus && bus.listPosition === 'before_start') rows.push(<BusRow key="bus" bus={bus} />);
  stops.forEach((stop, index) => {
    const time = stopTime(stop);
    rows.push(
      <li
        key={`${stop.id}-${index}`}
        data-stop-id={stop.id}
        ref={stop.isBoarding ? boardingRef : undefined}
        className={[
          'trip-stops__stop',
          stop.state === 'passed' ? 'is-passed' : '',
          stop.isBoarding ? 'is-boarding' : '',
        ].join(' ')}
      >
        <span className="trip-stops__name">
          {stop.state === 'passed' && <span className="sr-only">Passed</span>}
          {stop.name}
          {stop.isBoarding && <span className="trip-stops__tag">Your stop</span>}
        </span>
        {time && <time dateTime={stop.predictedAt || undefined}>{time}</time>}
      </li>
    );
    if (bus && busAfterStopId === stop.id) rows.push(<BusRow key="bus" bus={bus} />);
  });

  return (
    <ol className="trip-stops" aria-label="Stops in riding order">
      {rows}
    </ol>
  );
}

function TripSheet({
  route,
  trip,
  loading,
  refreshing,
  error,
  expanded,
  onToggle,
  onChangeStop,
  onRefresh,
}) {
  const boardingRef = useRef(null);

  useEffect(() => {
    if (expanded) boardingRef.current?.scrollIntoView?.({ block: 'center' });
  }, [expanded]);

  return (
    <section
      className={`trip-sheet ${expanded ? 'is-expanded' : ''}`}
      aria-labelledby="trip-sheet-title"
      style={{ '--route-color': route.color }}
    >
      <button
        className="trip-sheet__handle"
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span aria-hidden="true" className="trip-sheet__grip" />
        <span>{expanded ? 'Hide stops' : 'Show all stops'}</span>
        <FiChevronUp aria-hidden="true" />
      </button>

      <header className="trip-sheet__header">
        <p className="utility-label" id="trip-sheet-title">
          <span className="route-pill" data-long={route.shortName?.length > 2 || undefined}>
            {route.shortName}
          </span>
          {trip?.direction || route.name}
        </p>
        <button className="button button--ghost" type="button" onClick={onChangeStop}>
          Change stop
        </button>
      </header>

      <div className="trip-sheet__summary" aria-live="polite">
        <Summary route={route} trip={trip} loading={loading} error={error} />
      </div>

      {trip && <StopList trip={trip} boardingRef={boardingRef} />}

      <footer className="arrival-board__footer">
        <span>
          <FiRadio aria-hidden="true" />
          {trip?.meta?.stale ? 'Stale Centro update' : 'Centro BusTime'}
        </span>
        <span>
          Updated {relativeUpdate(trip?.meta?.sourceTime)}
          <button
            className="icon-button"
            type="button"
            onClick={onRefresh}
            disabled={loading || refreshing}
            aria-label="Refresh live arrivals"
            title="Refresh live arrivals"
          >
            <FiRefreshCw aria-hidden="true" className={refreshing ? 'is-spinning' : ''} />
          </button>
        </span>
      </footer>
    </section>
  );
}

export default TripSheet;
