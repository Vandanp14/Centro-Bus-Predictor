import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TripContext from '../TripContext';
import { getDirections, getStops } from '../services/apiService';
import { busRoutes } from '../Data/busData';

function FilterBar({ onSearch }) {
  const navigate = useNavigate();
  const { setTrip } = useContext(TripContext);

  const [localTrip, setLocalTrip] = useState({ route: '', direction: '', stop: '' });
  const [directions, setDirections] = useState([]);
  const [stops, setStops] = useState([]);
  const [directionsLoading, setDirectionsLoading] = useState(false);
  const [stopsLoading, setStopsLoading] = useState(false);

  useEffect(() => {
    if (!localTrip.route) {
      setDirections([]);
      setStops([]);
      return;
    }
    setDirectionsLoading(true);
    getDirections(localTrip.route).then(data => {
      setDirections(data?.directions || []);
      setDirectionsLoading(false);
    });
  }, [localTrip.route]);

  useEffect(() => {
    if (!localTrip.route || !localTrip.direction) {
      setStops([]);
      return;
    }
    setStopsLoading(true);
    getStops(localTrip.route, localTrip.direction).then(data => {
      setStops(Array.isArray(data) ? data : []);
      setStopsLoading(false);
    });
  }, [localTrip.route, localTrip.direction]);

  const handleSearch = () => {
    if (onSearch) {
      onSearch(localTrip);
    } else {
      setTrip(localTrip);
      navigate('/tracker');
    }
  };

  return (
    <div className="filter-bar">
      <div className="filter-bar__fields">
        <div className="field">
          <label htmlFor="filter-route">Route</label>
          <div className="select-shell">
            <select
              id="filter-route"
              value={localTrip.route}
              onChange={(e) =>
                setLocalTrip({ ...localTrip, route: e.target.value, direction: '', stop: '' })
              }
            >
              <option value="">Select Route</option>
              {busRoutes.map((r) => (
                <option key={r.routeId} value={r.routeId}>{r.routeId}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="filter-direction">Direction</label>
          <div className="select-shell">
            <select
              id="filter-direction"
              value={localTrip.direction}
              disabled={!localTrip.route}
              onChange={(e) =>
                setLocalTrip({ ...localTrip, direction: e.target.value, stop: '' })
              }
            >
              <option value="">{directionsLoading ? 'Loading…' : 'Select Direction'}</option>
              {directions.map((d) => (
                <option key={d.rtdir} value={d.rtdir}>{d.rtdir}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="filter-stop">Stop</label>
          <div className="select-shell">
            <select
              id="filter-stop"
              value={localTrip.stop}
              disabled={!localTrip.direction}
              onChange={(e) =>
                setLocalTrip({ ...localTrip, stop: e.target.value })
              }
            >
              <option value="">{stopsLoading ? 'Loading…' : 'Select Stop'}</option>
              {stops.map((s) => (
                <option key={s.stopId} value={s.stopId}>{s.stopName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <button
        className="button button--primary"
        type="button"
        onClick={handleSearch}
        disabled={!localTrip.stop}
      >
        Search
      </button>
    </div>
  );
}

export default FilterBar;
