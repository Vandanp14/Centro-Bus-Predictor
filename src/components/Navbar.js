import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FiActivity,
  FiClock,
  FiHelpCircle,
  FiMap,
  FiNavigation,
} from 'react-icons/fi';

const navItems = [
  { to: '/', label: 'Arrivals', icon: FiNavigation, key: 'arrivals' },
  { to: '/tracker', label: 'Live map', icon: FiMap, key: 'map' },
  { to: '/active', label: 'Active', icon: FiActivity, key: 'active' },
  { to: '/schedule', label: 'Schedules', icon: FiClock, key: 'schedules' },
  { to: '/help', label: 'Help', icon: FiHelpCircle, key: 'help' },
];

function Navbar() {
  const location = useLocation();

  const activeKey =
    location.pathname.startsWith('/route/') || location.pathname === '/'
      ? 'arrivals'
      : location.pathname.startsWith('/active')
        ? 'active'
        : location.pathname.startsWith('/tracker')
          ? 'map'
          : location.pathname.startsWith('/schedule')
          ? 'schedules'
          : location.pathname.startsWith('/help')
            ? 'help'
            : '';

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <Link className="brand" to="/" aria-label="Centro Oswego Live home">
          <span className="brand__copy">
            <strong>Centro</strong>
            <small>Oswego live</small>
          </span>
        </Link>

        <nav className="main-nav" aria-label="Primary navigation">
          <ul>
            {navItems.map(({ to, label, key }) => (
              <li key={to}>
                <Link
                  to={to}
                  aria-current={activeKey === key ? 'page' : undefined}
                  className={`main-nav__link ${activeKey === key ? 'is-active' : ''}`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="live-source">
          Oswego, New York
        </div>
        <Link className="icon-button mobile-help" to="/help" aria-label="Rider help">
          <FiHelpCircle aria-hidden="true" />
        </Link>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <ul>
          {navItems.map(({ to, label, icon: Icon, key }) => (
            <li key={to}>
              <Link
                to={to}
                aria-current={activeKey === key ? 'page' : undefined}
                className={`mobile-nav__link ${activeKey === key ? 'is-active' : ''}`}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export default Navbar;
