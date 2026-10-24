import React, { useMemo } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup } from 'react-leaflet';
import AnimatedVehicleMarker, { createVehicleIcon } from './AnimatedVehicleMarker';
import { FitPositions, MapTiles } from './MapBase';

const OSWEGO_CENTER = [43.4553, -76.51];

const hasPosition = (item) =>
  Boolean(item) && Number.isFinite(item.lat) && Number.isFinite(item.lng);

function TripMap({ route, trip }) {
  const bus = hasPosition(trip?.bus) ? trip.bus : null;
  const others = (trip?.otherVehicles || []).filter(hasPosition);
  const boarding = (trip?.stops || []).find((stop) => stop.isBoarding && hasPosition(stop));
  const line = (trip?.pattern?.points || []).map((point) => [point.lat, point.lng]);

  const busIcon = useMemo(
    () => (bus ? createVehicleIcon(bus, route.color) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route.color, bus?.id, bus?.heading, bus?.delayed]
  );
  const otherKey = others.map((v) => `${v.id}:${v.heading}`).join('|');
  const otherIcons = useMemo(
    () =>
      Object.fromEntries(
        others.map((vehicle) => [
          vehicle.id,
          createVehicleIcon(vehicle, route.color, { muted: true }),
        ])
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route.color, otherKey]
  );

  // Keep the student's two questions in view: where the bus is and where
  // they are. Without a bus, show the route.
  const focus = bus && boarding
    ? [[bus.lat, bus.lng], [boarding.lat, boarding.lng]]
    : boarding && line.length
      ? line
      : boarding
        ? [[boarding.lat, boarding.lng]]
        : line;

  return (
    <div className="map-canvas trip-map" aria-label={`${route.id} live map for your stop`}>
      <MapContainer center={OSWEGO_CENTER} zoom={13} zoomControl scrollWheelZoom>
        <MapTiles />

        {line.length > 1 && (
          <Polyline
            positions={line}
            pathOptions={{
              color: route.color,
              weight: 5,
              opacity: 0.88,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {boarding && (
          <CircleMarker
            center={[boarding.lat, boarding.lng]}
            radius={9}
            pathOptions={{
              color: '#FFFFFF',
              weight: 3,
              fillColor: '#132e43',
              fillOpacity: 1,
            }}
          >
            <Popup>
              <div className="map-popup">
                <span className="utility-label">Your stop</span>
                <strong>{boarding.name}</strong>
              </div>
            </Popup>
          </CircleMarker>
        )}

        {others.map((vehicle) => (
          <AnimatedVehicleMarker
            key={vehicle.id}
            vehicle={vehicle}
            routeColor={route.color}
            route={route}
            icon={otherIcons[vehicle.id]}
          />
        ))}

        {bus && (
          <AnimatedVehicleMarker
            key={bus.id}
            vehicle={bus}
            routeColor={route.color}
            route={route}
            icon={busIcon}
          />
        )}

        <FitPositions positions={focus} padding={[56, 56]} maxZoom={16} />
      </MapContainer>
    </div>
  );
}

export default TripMap;
