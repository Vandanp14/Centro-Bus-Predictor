import React from 'react';
import { render, screen } from '@testing-library/react';
import NextBusCard from './NextBusCard';

const route = {
  id: 'OSW10',
  name: 'SUNY Oswego Blue Route',
  color: '#78C7F0',
};

test('renders Centro due and following predictions', () => {
  render(
    <NextBusCard
      route={route}
      stopName="Campus Center"
      direction="FROM CAMPUS"
      payload={{
        predictions: [
          {
            due: true,
            minutes: 0,
            predictedAt: '2026-07-25T20:11:00-04:00',
            destination: 'Campus loop',
            vehicleId: '2212',
            delayed: false,
          },
          {
            due: false,
            minutes: 9,
            predictedAt: '2026-07-25T20:19:00-04:00',
            destination: 'Campus loop',
            vehicleId: '2213',
            delayed: false,
          },
        ],
        meta: { sourceTime: '2026-07-25T20:10:00-04:00', stale: false },
      }}
      loading={false}
      refreshing={false}
      error=""
      onRefresh={() => {}}
    />
  );

  expect(screen.getByText('Due')).toBeInTheDocument();
  expect(screen.getByText('Move to the stop now')).toBeInTheDocument();
  expect(screen.getByText('9 min')).toBeInTheDocument();
});

test('renders an honest no-service state', () => {
  render(
    <NextBusCard
      route={route}
      stopName="Campus Center"
      direction="FROM CAMPUS"
      payload={{
        predictions: [],
        message: 'No service scheduled',
        meta: { stale: false },
      }}
      loading={false}
      refreshing={false}
      error=""
      onRefresh={() => {}}
    />
  );

  expect(screen.getByText('No upcoming prediction')).toBeInTheDocument();
  expect(screen.getByText('No service scheduled')).toBeInTheDocument();
});

