import { useEffect, useRef, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const lerp = (a, b, t) => a + (b - a) * t;

function formatSpeed(speed) {
  if (speed == null) return '';
  return `${Math.round(speed)} mph`;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
function headingLabel(deg) {
  const index = Math.round(deg / 45) % 8;
  return COMPASS[index];
}

function relativeTime(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

function createVehicleIcon(vehicle, color, { muted = false } = {}) {
  const heading = Number(vehicle.heading || 0);
  const isDelayed = vehicle.delayed;
  return L.divIcon({
    className: `vehicle-marker-shell${muted ? ' vehicle-icon--muted' : ''}`,
    html: `
      <span class="vehicle-marker ${isDelayed ? 'vehicle-marker--delayed' : ''}" 
            style="--vehicle-color:${color};--heading:${heading}deg">
        <i${isDelayed ? ' class="vehicle-marker__delay-badge"' : ''}></i>
      </span>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  });
}

function VehiclePopup({ vehicle, route }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="map-popup map-popup--vehicle">
      <span className="utility-label">Bus {vehicle.id}</span>
      <strong>{vehicle.destination || route.name}</strong>
      <div className="vehicle-popup-grid">
        <span className="vehicle-attr">
          <span>Speed</span>
          <b>{formatSpeed(vehicle.speed)}</b>
        </span>
        <span className="vehicle-attr">
          <span>Heading</span>
          <b>{headingLabel(vehicle.heading)} ({vehicle.heading}°)</b>
        </span>
        <span className="vehicle-attr">
          <span>Status</span>
          <b className={vehicle.delayed ? 'status-delayed' : 'status-ontime'}>
            {vehicle.delayed ? 'Delayed' : 'On time'}
          </b>
        </span>
        <span className="vehicle-attr">
          <span>Updated</span>
          <b>{relativeTime(vehicle.updatedAt)}</b>
        </span>
      </div>
    </div>
  );
}

function AnimatedVehicleMarker({ vehicle, routeColor, route, icon }) {
  const markerRef = useRef(null);
  const startLatRef = useRef(vehicle.lat);
  const startLngRef = useRef(vehicle.lng);

  useEffect(() => {
    const startLat = startLatRef.current;
    const startLng = startLngRef.current;
    const endLat = vehicle.lat;
    const endLng = vehicle.lng;
    const duration = 700;
    const startTime = performance.now();

    let rafId;
    function animate(time) {
      const elapsed = time - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const lat = lerp(startLat, endLat, ease);
      const lng = lerp(startLng, endLng, ease);

      const marker = markerRef.current;
      if (marker) {
        marker.setLatLng([lat, lng]);
      }

      if (t < 1) {
        rafId = requestAnimationFrame(animate);
      }
    }

    rafId = requestAnimationFrame(animate);
    startLatRef.current = endLat;
    startLngRef.current = endLng;

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [vehicle.lat, vehicle.lng]);

  return (
    <Marker
      ref={markerRef}
      position={[vehicle.lat, vehicle.lng]}
      icon={icon}
      zIndexOffset={vehicle.delayed ? 2000 : 1000}
    >
      <Popup>
        <VehiclePopup vehicle={vehicle} route={route} />
      </Popup>
    </Marker>
  );
}

export { createVehicleIcon };
export default AnimatedVehicleMarker;
