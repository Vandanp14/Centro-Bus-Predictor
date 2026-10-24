import React from 'react';
import { render, screen } from '@testing-library/react';
import L from 'leaflet';
import TripMap from './TripMap';

const mockMap = { fitBounds: jest.fn(), setView: jest.fn() };

jest.mock('react-leaflet', () => {
  const { forwardRef } = require('react');
  return {
    MapContainer: ({ children }) => <div>{children}</div>,
    TileLayer: () => null,
    Polyline: () => <div data-testid="line" />,
    CircleMarker: ({ children }) => <div data-testid="stop">{children}</div>,
    Marker: forwardRef(({ children }, _ref) => <div data-testid="bus">{children}</div>),
    Popup: ({ children }) => <div>{children}</div>,
    useMap: () => mockMap,
  };
});

const route = { id: 'OSW17', name: 'Bridge Street', color: '#EC7B68' };

const trip = (overrides = {}) => ({
  stopId: '15888',
  bus: { id: '2213', lat: 43.46, lng: -76.48, heading: 270, delayed: false },
  otherVehicles: [{ id: '2216', lat: 43.45, lng: -76.52, heading: 90 }],
  stops: [
    { id: '17808', name: 'Route 104 & George St', lat: 43.461, lng: -76.47, isBoarding: false },
    { id: '15888', name: 'E Bridge St & E 1st St', lat: 43.455, lng: -76.51, isBoarding: true },
  ],
  pattern: { id: '9768', points: [{ lat: 43.46, lng: -76.47 }, { lat: 43.455, lng: -76.51 }] },
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

test('draws route line, boarding stop and buses', () => {
  render(<TripMap route={route} trip={trip()} />);
  expect(screen.getAllByTestId('line')).toHaveLength(1);
  expect(screen.getAllByTestId('stop')).toHaveLength(1);
  expect(screen.getAllByTestId('bus')).toHaveLength(2);
  expect(screen.getByLabelText('OSW17 live map for your stop')).toBeInTheDocument();
});

test('fits to bus and boarding stop', () => {
  render(<TripMap route={route} trip={trip()} />);
  expect(mockMap.fitBounds).toHaveBeenCalled();
  const bounds = mockMap.fitBounds.mock.calls[0][0];
  expect(bounds.contains(L.latLng(43.46, -76.48))).toBe(true);
  expect(bounds.contains(L.latLng(43.455, -76.51))).toBe(true);
});

test('works without a bus', () => {
  render(<TripMap route={route} trip={trip({ bus: null, otherVehicles: [] })} />);
  expect(screen.queryAllByTestId('bus')).toHaveLength(0);
  expect(screen.getAllByTestId('stop')).toHaveLength(1);
});

test('skips a bus that has no position', () => {
  render(<TripMap route={route} trip={trip({ bus: { id: '2213', lat: null, lng: null }, otherVehicles: [] })} />);
  expect(screen.queryAllByTestId('bus')).toHaveLength(0);
});
