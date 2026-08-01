import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BrowserRouter as Router,
  Link,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { FiArrowLeft, FiExternalLink } from 'react-icons/fi';
import Home from './pages/Home';
import Tracker from './pages/Tracker';
import Schedule from './pages/Schedule';
import RouteDetail from './pages/RouteDetail';
import HelpPage from './pages/HelpPage';
import ActivePage from './pages/ActivePage';
import Navbar from './components/Navbar';
import TripContext from './TripContext';
import './App.css';

const EMPTY_TRIP = { route: '', direction: '', stop: '', stopName: '' };

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}

function NotFound() {
  return (
    <main className="page page--centered" id="main-content">
      <section className="not-found">
        <p className="eyebrow">Wrong stop</p>
        <h1>This route ends here.</h1>
        <p>The page you requested is not part of the Oswego network.</p>
        <Link className="button button--primary" to="/">
          <FiArrowLeft aria-hidden="true" />
          Back to arrivals
        </Link>
      </section>
    </main>
  );
}

function SkipLink() {
  return (
    <a className="skip-link" href="#main-content">
      Skip to main content
    </a>
  );
}

function AppFrame() {
  const location = useLocation();
  const [trip, setTripState] = useState(() => {
    try {
      return {
        ...EMPTY_TRIP,
        ...JSON.parse(window.localStorage.getItem('centro:last-trip')),
      };
    } catch {
      return EMPTY_TRIP;
    }
  });

  const setTrip = useCallback((nextTrip) => {
    setTripState((current) => {
      const value =
        typeof nextTrip === 'function' ? nextTrip(current) : nextTrip;
      const normalized = { ...EMPTY_TRIP, ...value };
      if (JSON.stringify(current) === JSON.stringify(normalized)) {
        return current;
      }
      window.localStorage.setItem('centro:last-trip', JSON.stringify(normalized));
      return normalized;
    });
  }, []);

  const contextValue = useMemo(() => ({ trip, setTrip }), [setTrip, trip]);

  return (
    <TripContext.Provider value={contextValue}>
      <ScrollToTop />
      <div className="app-shell">
        <SkipLink />
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/active" element={<ActivePage />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/route/:routeId" element={<RouteDetail />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <footer className="site-footer">
          <div>
            <span className="site-footer__brand">Centro Oswego Live</span>
            <span>Powered by Centro BusTime data.</span>
          </div>
          <a
            href="https://www.centro.org/routes-schedules"
            target="_blank"
            rel="noreferrer"
          >
            centro.org
            <FiExternalLink aria-hidden="true" />
          </a>
        </footer>
      </div>
    </TripContext.Provider>
  );
}

function App() {
  return (
    <Router>
      <AppFrame />
    </Router>
  );
}

export default App;
