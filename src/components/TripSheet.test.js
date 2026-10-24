import React from 'react';
import { render as renderUI, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TripSheet from './TripSheet';

const route = {
  id: 'OSW17',
  shortName: '17',
  name: 'Bridge Street',
  color: '#EC7B68',
  scheduleUrl: 'https://www.centro.org/Route-Time-Tables/osw-17',
};

const NO_SERVICE = 'No bus is running on this route right now.';

const liveTrip = (overrides = {}, busOverrides = {}) => ({
  routeId: 'OSW17',
  direction: 'WESTBOUND',
  stopId: '15888',
  status: 'live',
  message: null,
  bus: {
    id: '2213',
    minutes: 21,
    due: false,
    predictedAt: '2026-10-24T10:44:00-04:00',
    stopsAway: 12,
    delayed: false,
    destination: '17 Bridge St to Campus',
    onBoardingDirection: false,
    ...busOverrides,
  },
  stops: [
    { id: '9614', name: 'Walmart - Oswego', state: 'passed', minutes: null, due: false, isBoarding: false },
    { id: '17808', name: 'Route 104 & George St', state: 'upcoming', minutes: 8, due: false, isBoarding: false },
    { id: '15888', name: 'E Bridge St & E 1st St', state: 'upcoming', minutes: 21, due: false, isBoarding: true },
    { id: '15521', name: 'SUNY OSWEGO CAMPUS CENTER', state: 'upcoming', minutes: null, due: false, isBoarding: false },
  ],
  busAfterStopId: '9614',
  following: [],
  meta: { stale: false, sourceTime: '2026-10-24T10:23:00-04:00' },
  ...overrides,
});

const baseProps = {
  route,
  loading: false,
  refreshing: false,
  error: '',
  expanded: false,
  onToggle: jest.fn(),
  onChangeStop: jest.fn(),
  onRefresh: jest.fn(),
};

const render = (props) => renderUI(<TripSheet {...baseProps} {...props} />, { wrapper: MemoryRouter });

const expectNoPlaceholders = () =>
  expect(screen.queryByText(/undefined|null|NaN/)).not.toBeInTheDocument();

test('collapsed shows countdown, stops away, bus and arrival time', () => {
  render({ trip: liveTrip() });
  const summary = screen.getByRole('group', { name: 'Next bus arrival' });
  expect(within(summary).getByText('21')).toBeInTheDocument();
  expect(within(summary).getByText('min')).toBeInTheDocument();
  expect(screen.getByText('12 stops away')).toBeInTheDocument();
  expect(screen.getByText('Bus 2213')).toBeInTheDocument();
  expect(screen.getByText(/^Arrives /)).toBeInTheDocument();
  expectNoPlaceholders();
});

test('one stop away is singular', () => {
  render({ trip: liveTrip({}, { minutes: 1, stopsAway: 1 }) });
  expect(screen.getByText('1 stop away')).toBeInTheDocument();
});

test('due bus reads Due', () => {
  render({ trip: liveTrip({}, { minutes: 0, due: true }) });
  const summary = screen.getByRole('group', { name: 'Next bus arrival' });
  expect(within(summary).getByText('Due')).toBeInTheDocument();
  expect(within(summary).queryByText('min')).not.toBeInTheDocument();
});

test('toggle exposes the ordered stop list', () => {
  const onToggle = jest.fn();
  const { rerender } = render({ trip: liveTrip(), onToggle });
  const toggle = screen.getByRole('button', { name: 'Show all stops' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  userEvent.click(toggle);
  expect(onToggle).toHaveBeenCalled();

  rerender(<TripSheet {...baseProps} trip={liveTrip()} expanded />);
  expect(screen.getByRole('button', { name: 'Hide stops' })).toHaveAttribute('aria-expanded', 'true');
  const list = screen.getByRole('list', { name: 'Stops in riding order' });
  expect(list.tagName).toBe('OL');
  const items = list.querySelectorAll('[data-stop-id]');
  expect(items).toHaveLength(4);
  expect(within(items[2]).getByText('Your stop')).toBeInTheDocument();
  expect(within(items[0]).getByText('Passed')).toBeInTheDocument();
  expect(within(items[1]).getByText('8 min')).toBeInTheDocument();
  expect(within(items[3]).getByText('no time yet')).toBeInTheDocument();
});

test('bus marker row sits after busAfterStopId', () => {
  render({ trip: liveTrip(), expanded: true });
  const list = screen.getByRole('list', { name: 'Stops in riding order' });
  const rows = Array.from(list.children);
  const busIndex = rows.findIndex((row) => row.textContent.includes('Bus 2213 is here'));
  expect(rows[busIndex - 1]).toHaveAttribute('data-stop-id', '9614');
});

test('bus marker precedes the first stop when the bus is not on this direction yet', () => {
  render({ trip: liveTrip({ busAfterStopId: null }), expanded: true });
  const list = screen.getByRole('list', { name: 'Stops in riding order' });
  expect(list.children[0]).toHaveTextContent('Bus 2213');
  expect(list.children[0]).toHaveTextContent('17 Bridge St to Campus');
});

test('beyond window with count', () => {
  render({
    trip: liveTrip(
      { status: 'beyond_window', message: 'A bus is running on this route.' },
      { minutes: null, predictedAt: null, stopsAway: 31 },
    ),
  });
  expect(screen.getByText('Bus on the route, no time yet')).toBeInTheDocument();
  expect(screen.getByText('31 stops away · no time yet')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Check the official schedule/ })).toHaveAttribute('href', route.scheduleUrl);
  expectNoPlaceholders();
});

test('beyond window without a tracked bus', () => {
  render({ trip: liveTrip({ status: 'beyond_window', message: 'A bus is running on this route.', bus: null }) });
  expect(screen.getByText('Bus on the route, no time yet')).toBeInTheDocument();
  expect(screen.queryByText(/stops? away/)).not.toBeInTheDocument();
});

test('no service', () => {
  render({ trip: liveTrip({ status: 'no_service', message: NO_SERVICE, bus: null, busAfterStopId: null }) });
  expect(screen.getByText('No bus running right now')).toBeInTheDocument();
  expect(screen.getByText(NO_SERVICE)).toBeInTheDocument();
  expectNoPlaceholders();
});

test('error and loading states', () => {
  const { rerender } = render({ trip: null, error: 'Service is unavailable.' });
  expect(screen.getByText('Live arrivals did not load')).toBeInTheDocument();
  rerender(<TripSheet {...baseProps} trip={null} loading />);
  expect(screen.getByLabelText('Loading live arrivals')).toBeInTheDocument();
});

test('stale and delay labels', () => {
  render({ trip: liveTrip({ meta: { stale: true } }, { delayed: true }) });
  expect(screen.getByText('Stale Centro update')).toBeInTheDocument();
  expect(screen.getByText('Centro reports a delay')).toBeInTheDocument();
});

test('change stop control', () => {
  const onChangeStop = jest.fn();
  render({ trip: liveTrip(), onChangeStop });
  userEvent.click(screen.getByRole('button', { name: 'Change stop' }));
  expect(onChangeStop).toHaveBeenCalled();
});
