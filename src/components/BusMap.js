import React, { useEffect, useMemo } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { FiArrowRight, FiNavigation } from 'react-icons/fi';

const OSWEGO_CENTER = [43.4553, -76.51];

function FitMap({ patterns, stops, vehicles }) {
  const map = useMap();

  useEffect(() => {
    const positions = [
      ...patterns.flatMap((pattern) =>
        pattern.points.map((point) => [point.lat, point.lng])
      ),
      ...stops.map((stop) => [stop.lat, stop.lng]),
      ...vehicles.map((vehicle) => [vehicle.lat, vehicle.lng]),
    ].filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), {
        padding: [42, 42],
        maxZoom: 15,
      });
    } else if (positions.length === 1) {
      map.setView(positions[0], 15);
    }
  }, [map, patterns, stops, vehicles]);

  return null;
}

const createVehicleIcon = (vehicle, color) =>
  L.divIcon({
    className: 'vehicle-marker-shell',
    html: `
      <span class="vehicle-marker" style="--vehicle-color:${color};--heading:${Number(
        vehicle.heading || 0
      )}deg">
        <i></i>
      </span>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -20],
  });

function BusMap({ route, direction, patterns, stops, vehicles }) {
  const routeColor = route.color;
  const vehicleIcons = useMemo(
    () =>
      Object.fromEntries(
        vehicles.map((vehicle) => [
          vehicle.id,
          createVehicleIcon(vehicle, routeColor),
        ])
      ),
    [routeColor, vehicles]
  );

  return (
    <div className="map-canvas" aria-label={`${route.id} live route map`}>
      <MapContainer
        center={OSWEGO_CENTER}
        zoom={13}
        zoomControl
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {patterns.map((pattern) => (
          <Polyline
            key={pattern.id}
            positions={pattern.points.map((point) => [point.lat, point.lng])}
            pathOptions={{
              color: routeColor,
              weight: 5,
              opacity: 0.88,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        ))}

        {stops.map((stop) => (
          <CircleMarker
            key={stop.id}
            center={[stop.lat, stop.lng]}
            radius={6}
            pathOptions={{
              color: '#080b0f',
              weight: 3,
              fillColor: '#f5f7f8',
              fillOpacity: 1,
            }}
          >
            <Popup>
              <div className="map-popup">
                <span className="utility-label">Stop {stop.id}</span>
                <strong>{stop.name}</strong>
                <Link
                  to={`/route/${route.id}?direction=${encodeURIComponent(
                    direction
                  )}&stop=${stop.id}`}
                >
                  View arrivals
                  <FiArrowRight aria-hidden="true" />
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {vehicles.map((vehicle) => (
          <Marker
            key={vehicle.id}
            position={[vehicle.lat, vehicle.lng]}
            icon={vehicleIcons[vehicle.id]}
            zIndexOffset={1000}
          >
            <Popup>
              <div className="map-popup map-popup--vehicle">
                <span className="utility-label">
                  <FiNavigation aria-hidden="true" />
                  Live bus {vehicle.id}
                </span>
                <strong>{vehicle.destination || route.name}</strong>
                <small>
                  {vehicle.delayed
                    ? 'Centro reports this bus delayed'
                    : 'Moving on route'}
                </small>
              </div>
            </Popup>
          </Marker>
        ))}

        <FitMap patterns={patterns} stops={stops} vehicles={vehicles} />
      </MapContainer>
    </div>
  );
}

export default BusMap;
