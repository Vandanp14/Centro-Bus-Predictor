import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BrowserRouter as Router,
  Link,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiArrowLeft, FiExternalLink } from 'react-icons/fi';
import Home from './pages/Home';
import Tracker from './pages/Tracker';
import Schedule from './pages/Schedule';
import RouteDetail from './pages/RouteDetail';
import HelpPage from './pages/HelpPage';
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
    <main className="page page--centered">
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

const pageTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: 'easeOut' },
};

function PageTransition({ children }) {
  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      exit={pageTransition.exit}
      transition={pageTransition.transition}
    >
      {children}
    </motion.div>
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
        <Navbar />
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<PageTransition><Home /></PageTransition>} />
            <Route path="/tracker" element={<PageTransition><Tracker /></PageTransition>} />
            <Route path="/schedule" element={<PageTransition><Schedule /></PageTransition>} />
            <Route path="/route/:routeId" element={<PageTransition><RouteDetail /></PageTransition>} />
            <Route path="/help" element={<PageTransition><HelpPage /></PageTransition>} />
            <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
          </Routes>
        </AnimatePresence>
        <footer className="site-footer">
          <div>
            <span className="site-footer__brand">Centro Oswego Live</span>
            <span>Independent student project using Centro BusTime data.</span>
          </div>
          <a
            href="https://www.centro.org/routes-schedules"
            target="_blank"
            rel="noreferrer"
          >
            Official Centro service
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
