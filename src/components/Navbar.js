import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
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
          <span className="brand__mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <span className="brand__copy">
            <strong>Centro</strong>
            <small>Oswego live</small>
          </span>
        </Link>

        <nav className="main-nav" aria-label="Primary navigation">
          <ul>
            {navItems.map(({ to, label, key }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={`main-nav__link ${activeKey === key ? 'is-active' : ''}`}
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="live-source">
          <span className="live-dot" aria-hidden="true" />
          Centro BusTime
        </div>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <ul>
          {navItems.map(({ to, label, icon: Icon, key }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={`mobile-nav__link ${activeKey === key ? 'is-active' : ''}`}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export default Navbar;
