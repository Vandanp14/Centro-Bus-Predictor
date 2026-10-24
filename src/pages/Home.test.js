import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import TripContext from '../TripContext';
import Home from './Home';
import { getDirections, getRoutes, getStops } from '../services/apiService';
import { ROUTE_CATALOG } from '../Data/routeCatalog';

jest.mock('../services/apiService');

function Destination() {
  const location = useLocation();
  return <output data-testid="destination">{location.pathname + location.search}</output>;
}

function renderHome(trip = {}) {
  const setTrip = jest.fn();
  render(
    <TripContext.Provider value={{ trip, setTrip }}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/route/:routeId" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </TripContext.Provider>
  );
  return setTrip;
}

beforeEach(() => {
  jest.clearAllMocks();
  getRoutes.mockResolvedValue({ routes: ROUTE_CATALOG, meta: { live: true } });
  getDirections.mockResolvedValue({ directions: [
    { id: 'FROM CAMPUS', name: 'FROM CAMPUS' },
    { id: 'TO CAMPUS', name: 'TO CAMPUS' },
  ] });
  getStops.mockResolvedValue({ stops: [{ id: '15521', name: 'Campus Center' }] });
});

test('preserves route, direction, stop dependencies and encoded arrival navigation', async () => {
  const setTrip = renderHome();
  expect(screen.getByLabelText('Direction')).toBeDisabled();
  expect(screen.getByLabelText(/Stop|Boarding stop/i)).toBeDisabled();
  userEvent.selectOptions(screen.getByLabelText('Route'), 'OSW10');
  await screen.findByRole('option', { name: 'FROM CAMPUS' });
  userEvent.selectOptions(screen.getByLabelText('Direction'), 'FROM CAMPUS');
  await screen.findByRole('option', { name: 'Campus Center' });
  userEvent.selectOptions(screen.getByLabelText(/Stop|Boarding stop/i), '15521');
  userEvent.click(screen.getByRole('button', { name: 'See live arrivals' }));
  expect(setTrip).toHaveBeenCalledWith({ route: 'OSW10', direction: 'FROM CAMPUS', stop: '15521', stopName: 'Campus Center' });
  expect(screen.getByTestId('destination')).toHaveTextContent('/route/OSW10?direction=FROM+CAMPUS&stop=15521');
});

test('restores the saved trip after directions and stops load', async () => {
  renderHome({ route: 'OSW10', direction: 'FROM CAMPUS', stop: '15521', stopName: 'Campus Center' });
  await waitFor(() => expect(screen.getByLabelText(/Stop|Boarding stop/i)).toHaveValue('15521'));
  expect(screen.getByLabelText('Direction')).toHaveValue('FROM CAMPUS');
  expect(screen.getByRole('button', { name: 'See live arrivals' })).toBeEnabled();
});

test('keeps arrivals unavailable when directions cannot load', async () => {
  getDirections.mockRejectedValue(new Error('Centro directions are unavailable.'));
  renderHome();
  userEvent.selectOptions(screen.getByLabelText('Route'), 'OSW10');
  await screen.findByText('Centro directions are unavailable.');
  expect(screen.getByRole('button', { name: 'See live arrivals' })).toBeDisabled();
});
