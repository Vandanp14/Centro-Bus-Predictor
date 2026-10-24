import React from 'react';
import { render as renderUI, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NextBusCard from './NextBusCard';

const route = {
  id: 'OSW10',
  name: 'SUNY Oswego Blue Route',
  color: '#78C7F0',
  scheduleUrl: 'https://www.centro.org/Route-Time-Tables/osw-10',
};

const render = (ui) => renderUI(ui, { wrapper: MemoryRouter });
const cardProps = {
  route, stopName: 'Campus Center', direction: 'FROM CAMPUS',
  loading: false, refreshing: false, error: '', onRefresh: jest.fn(),
};

test('links the arrival to its route map', () => {
  render(<NextBusCard {...cardProps} payload={{ predictions: [{ minutes: 8, predictedAt: '2026-07-25T20:19:00-04:00', vehicleId: '2212' }] }} />);
  expect(screen.getByRole('link', { name: 'View route map' })).toHaveAttribute('href', '/tracker?route=OSW10&direction=FROM%20CAMPUS');
});

test('shows a time-only estimate without inventing a minutes value', () => {
  render(<NextBusCard {...cardProps} payload={{ predictions: [{ predictedAt: '2026-07-25T20:19:00-04:00' }] }} />);
  expect(within(screen.getByRole('group', { name: 'Next bus arrival' })).queryByText('min')).not.toBeInTheDocument();
  expect(screen.queryByText(/undefined|null|NaN/)).not.toBeInTheDocument();
  expect(screen.getByText('Expected arrival time')).toBeInTheDocument();
});

test('treats zero minutes as due even without the due flag', () => {
  render(<NextBusCard {...cardProps} payload={{ predictions: [{ minutes: 0 }] }} />);
  expect(screen.getByText('Due')).toBeInTheDocument();
  expect(screen.getByText('Move to the stop now')).toBeInTheDocument();
});

test.each([
  [{ stopName: '' }, 'Pick where you are boarding'],
  [{ error: 'Service is unavailable.' }, 'Live arrivals did not load'],
  [{ payload: { predictions: [] } }, 'No upcoming prediction'],
])('preserves the rider state %s', (overrides, title) => {
  render(<NextBusCard {...cardProps} {...overrides} />);
  expect(screen.getByText(title)).toBeInTheDocument();
});

test('shows loading and disables refresh', () => {
  render(<NextBusCard {...cardProps} loading />);
  expect(screen.getByLabelText('Loading live arrivals')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Refresh live arrivals' })).toBeDisabled();
});

test('keeps stale-source and vehicle-delay information visible', () => {
  render(<NextBusCard {...cardProps} payload={{ predictions: [{ minutes: 8, delayed: true }], meta: { stale: true } }} />);
  expect(screen.getByText('Stale Centro update')).toBeInTheDocument();
  expect(screen.getByText('Centro reports a delay')).toBeInTheDocument();
});

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


test('says a bus is coming when it is beyond the prediction window', () => {
  render(<NextBusCard {...cardProps} payload={{
    predictions: [],
    status: 'beyond_window',
    message: 'A bus is running on this route, but it is more than about 45 minutes from this stop.',
  }} />);
  expect(screen.getByText('Bus on the route, no time yet')).toBeInTheDocument();
  expect(screen.queryByText('No upcoming prediction')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /official schedule/i })).toHaveAttribute('href', route.scheduleUrl);
});

test('says no bus is running when the route has no live vehicles', () => {
  render(<NextBusCard {...cardProps} payload={{
    predictions: [],
    status: 'no_service',
    message: 'No bus is running on this route right now.',
  }} />);
  expect(screen.getByText('No bus running right now')).toBeInTheDocument();
  expect(screen.getByText('No bus is running on this route right now.')).toBeInTheDocument();
});
