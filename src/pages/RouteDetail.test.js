import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RouteDetail from './RouteDetail';
import TripContext from '../TripContext';
import { getDirections, getStops, getPredictions } from '../services/apiService';

jest.mock('../services/apiService');

beforeEach(() => {
  getDirections.mockResolvedValue({ directions: [{ id: 'FROM CAMPUS', name: 'FROM CAMPUS' }] });
  getStops.mockResolvedValue({ stops: [{ id: '15521', name: 'Campus Center' }] });
  getPredictions.mockResolvedValue({ predictions: [{ minutes: 8 }] });
});

function showRoute(query) {
  render(<TripContext.Provider value={{ trip: {}, setTrip: jest.fn() }}>
    <MemoryRouter initialEntries={['/route/OSW10' + query]}>
      <Routes><Route path="/route/:routeId" element={<RouteDetail />} /></Routes>
    </MemoryRouter>
  </TripContext.Provider>);
}

test('prioritizes a selected stop arrival while keeping trip editing accessible', async () => {
  showRoute('?direction=FROM+CAMPUS&stop=15521');
  await screen.findByRole('heading', { name: 'Campus Center' });
  const summary = screen.getByText('Change direction or stop');
  expect(summary.closest('details')).not.toHaveAttribute('open');
  userEvent.click(summary);
  expect(summary.closest('details')).toHaveAttribute('open');
  expect(screen.getByLabelText('Boarding stop')).toHaveValue('15521');
});

test('shows the trip controls immediately when no stop is selected', async () => {
  showRoute('?direction=FROM+CAMPUS');
  await screen.findByRole('button', { name: 'FROM CAMPUS' });
  expect(screen.getByText('Choose your stop').closest('details')).toHaveAttribute('open');
});
