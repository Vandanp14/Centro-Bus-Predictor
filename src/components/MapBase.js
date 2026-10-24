import { useEffect } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

export function MapTiles() {
  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      maxZoom={19}
    />
  );
}

export function FitPositions({ positions, padding = [42, 42], maxZoom = 15 }) {
  const map = useMap();
  const valid = positions.filter(
    ([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng)
  );
  // Refit only when coordinates change, not on every parent render.
  const key = valid.map((position) => position.join(',')).join('|');

  useEffect(() => {
    if (valid.length > 1) {
      map.fitBounds(L.latLngBounds(valid), { padding, maxZoom });
    } else if (valid.length === 1) {
      map.setView(valid[0], maxZoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  return null;
}
