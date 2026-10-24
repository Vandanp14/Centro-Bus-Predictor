import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiArrowUpRight,
  FiCalendar,
  FiClock,
  FiInfo,
} from 'react-icons/fi';
import TripContext from '../TripContext';
import { ROUTE_CATALOG } from '../Data/routeCatalog';

const groups = [
  {
    title: 'SUNY Oswego',
    description: 'Campus service while classes are in session.',
    routeIds: ['OSW10', 'OSW11'],
  },
  {
    title: 'City of Oswego',
    description: 'Local city and shopper routes.',
    routeIds: ['OSW09', 'OSW17', 'OSW18', 'OSW19'],
  },
  {
    title: 'Oswego County',
    description: 'Mexico and Fulton service, with transfers to Oswego routes.',
    routeIds: ['MEX16', 'FUL14', 'FUL15'],
  },
  {
    title: 'Regional',
    description: 'Connections between Oswego and Syracuse.',
    routeIds: ['OSW46', 'SY46'],
  },
];

function Schedule() {
  const { trip } = useContext(TripContext);

  return (
    <main className="page schedule-page" id="main-content">
      <header className="page-heading">
        <p className="eyebrow">
          <FiCalendar aria-hidden="true" />
          Official service times
        </p>
        <h1>Centro schedules</h1>
        <p>
          Schedules change by service day and semester. These links open
          Centro’s maintained route pages, where you can choose your travel date.
        </p>
      </header>

      {trip.route && (
        <section className="recent-trip">
          <div>
            <span className="utility-label">Your recent route</span>
            <strong>
              {trip.route}
              {trip.stopName ? ` · ${trip.stopName}` : ''}
            </strong>
          </div>
          <Link
            className="button button--secondary"
            to={`/route/${trip.route}?direction=${encodeURIComponent(
              trip.direction || ''
            )}&stop=${encodeURIComponent(trip.stop || '')}`}
          >
            Live arrivals
            <FiArrowRight aria-hidden="true" />
          </Link>
        </section>
      )}

      <div className="schedule-layout">
        <div className="schedule-groups">
          {groups.map((group) => (
            <section className="schedule-group" key={group.title}>
              <header>
                <div>
                  <h2>{group.title}</h2>
                  <p>{group.description}</p>
                </div>
                <span>{group.routeIds.length}</span>
              </header>

              <div className="schedule-list">
                {group.routeIds.map((routeId) => {
                  const route = ROUTE_CATALOG.find(
                    (item) => item.id === routeId
                  );
                  return (
                    <a
                      className="schedule-row"
                      href={route.scheduleUrl}
                      target="_blank"
                      rel="noreferrer"
                      key={route.id}
                      style={{ '--route-color': route.color }}
                    >
                      <span className="route-pill" data-long={route.shortName.length > 2 || undefined}>{route.shortName}</span>
                      <span>
                        <strong>{route.name}</strong>
                        <small>View times, map, and active service alerts</small>
                      </span>
                      <span className="schedule-row__action">
                        Open Centro
                        <FiArrowUpRight aria-hidden="true" />
                      </span>
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <aside className="schedule-aside">
          <div className="schedule-aside__icon">
            <FiInfo aria-hidden="true" />
          </div>
          <h2>Schedule or live arrival?</h2>
          <p>
            A schedule is the planned service. A live arrival is Centro’s
            current estimate for one bus at one stop.
          </p>
          <dl>
            <div>
              <dt>
                <FiClock aria-hidden="true" />
                Before leaving
              </dt>
              <dd>Use live arrivals for the latest estimate.</dd>
            </div>
            <div>
              <dt>
                <FiCalendar aria-hidden="true" />
                Planning ahead
              </dt>
              <dd>Use the official schedule for your travel date.</dd>
            </div>
          </dl>
          <Link className="text-link" to="/">
            Find a live arrival
            <FiArrowRight aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </main>
  );
}

export default Schedule;
