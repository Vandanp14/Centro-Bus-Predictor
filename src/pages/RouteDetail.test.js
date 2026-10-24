import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RouteDetail from './RouteDetail';
import TripContext from '../TripContext';
import { getDirections, getStops, getTrip } from '../services/apiService';

jest.mock('../services/apiService');
jest.mock('../components/TripMap', () => () => <div>Trip map</div>);

const tripFor = (stopId, minutes, stopsAway) => ({
  routeId: 'OSW10',
  direction: 'FROM CAMPUS',
  stopId,
  status: 'live',
  message: null,
  bus: { id: '2212', minutes, due: false, predictedAt: null, stopsAway, delayed: false },
  stops: [],
  busAfterStopId: null,
  otherVehicles: [],
  pattern: null,
  following: [],
  meta: { stale: false },
});

beforeEach(() => {
  jest.clearAllMocks();
  getDirections.mockResolvedValue({ directions: [{ id: 'FROM CAMPUS', name: 'FROM CAMPUS' }] });
  getStops.mockResolvedValue({ stops: [
    { id: '15521', name: 'Campus Center' },
    { id: '9679', name: 'Washington Blvd & Baylis St' },
  ] });
  getTrip.mockImplementation((_route, stopId) => Promise.resolve(tripFor(stopId, 21, 12)));
});

function showRoute(query) {
  render(<TripContext.Provider value={{ trip: {}, setTrip: jest.fn() }}>
    <MemoryRouter initialEntries={['/route/OSW10' + query]}>
      <Routes><Route path="/route/:routeId" element={<RouteDetail />} /></Routes>
    </MemoryRouter>
  </TripContext.Provider>);
}

test('selected stop shows the trip view with countdown and stops away', async () => {
  showRoute('?direction=FROM+CAMPUS&stop=15521');
  expect(await screen.findByRole('group', { name: '12 stops away' })).toBeInTheDocument();
  expect(screen.getByText('Trip map')).toBeInTheDocument();
  expect(screen.getByText('21')).toBeInTheDocument();
  expect(getTrip).toHaveBeenCalledWith('OSW10', '15521', 'FROM CAMPUS', expect.anything());
});

test('change stop opens the picker', async () => {
  showRoute('?direction=FROM+CAMPUS&stop=15521');
  await screen.findByRole('group', { name: '12 stops away' });
  const picker = screen.getByLabelText('Boarding stop').closest('details');
  expect(picker).not.toHaveAttribute('open');
  userEvent.click(screen.getByRole('button', { name: 'Change stop' }));
  expect(picker).toHaveAttribute('open');
  expect(screen.getByLabelText('Boarding stop')).toHaveValue('15521');
});

test('shows the trip controls immediately when no stop is selected', async () => {
  showRoute('?direction=FROM+CAMPUS');
  await screen.findByRole('button', { name: 'FROM CAMPUS' });
  expect(screen.getByText('Choose your stop').closest('details')).toHaveAttribute('open');
  expect(screen.queryByText('Trip map')).not.toBeInTheDocument();
});

test('ignores a trip response for a previous stop', async () => {
  let resolveFirst;
  getTrip.mockImplementation((_route, stopId) => {
    if (stopId === '15521') {
      return new Promise((resolve) => { resolveFirst = resolve; });
    }
    return Promise.resolve(tripFor(stopId, 4, 2));
  });
  showRoute('?direction=FROM+CAMPUS&stop=15521');
  await screen.findByLabelText('Boarding stop');
  await screen.findByRole('option', { name: 'Washington Blvd & Baylis St' });

  userEvent.click(screen.getByRole('button', { name: 'Change stop' }));
  userEvent.selectOptions(screen.getByLabelText('Boarding stop'), '9679');
  expect(await screen.findByRole('group', { name: '2 stops away' })).toBeInTheDocument();

  await act(async () => {
    resolveFirst(tripFor('15521', 21, 12));
  });
  expect(screen.queryByRole('group', { name: '12 stops away' })).not.toBeInTheDocument();
  expect(screen.getByRole('group', { name: '2 stops away' })).toBeInTheDocument();
});
