import React, { useEffect, useMemo } from 'react';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { FiArrowRight } from 'react-icons/fi';
import AnimatedVehicleMarker, { createVehicleIcon } from './AnimatedVehicleMarker';

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

function BusMap({ route, direction, patterns, stops, vehicles }) {
  const routeColor = route.color;
  const iconKey = vehicles
    .map((v) => `${v.id}:${v.heading}:${v.delayed}`)
    .join('|');
  const vehicleIcons = useMemo(
    () =>
      Object.fromEntries(
        vehicles.map((vehicle) => [
          vehicle.id,
          createVehicleIcon(vehicle, routeColor),
        ])
      ),
    [routeColor, iconKey]
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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
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
              color: '#4B5563',
              weight: 2,
              fillColor: '#FFFFFF',
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
          <AnimatedVehicleMarker
            key={vehicle.id}
            vehicle={vehicle}
            routeColor={routeColor}
            route={route}
            icon={vehicleIcons[vehicle.id]}
          />
        ))}

        <FitMap patterns={patterns} stops={stops} vehicles={vehicles} />
      </MapContainer>
    </div>
  );
}

export default BusMap;
