import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Tracker from './Tracker';
import { getDirections, getStops, getPatterns, getVehicles } from '../services/apiService';

jest.mock('../services/apiService');
jest.mock('../components/BusMap', () => () => <div>Route map canvas</div>);

test('reports an empty vehicle feed without an unconditional live badge', async () => {
  getDirections.mockResolvedValue({ directions: [{ id: 'FROM CAMPUS', name: 'FROM CAMPUS' }] });
  getStops.mockResolvedValue({ stops: [] });
  getPatterns.mockResolvedValue({ patterns: [] });
  getVehicles.mockResolvedValue({ vehicles: [], meta: { live: false }, message: 'No reporting vehicles.' });
  render(<MemoryRouter initialEntries={['/tracker?route=OSW10']}><Tracker /></MemoryRouter>);
  await screen.findByText('No reporting vehicles.');
  expect(screen.getByText('Route map canvas')).toBeInTheDocument();
  expect(screen.queryByText('LIVE')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Check arrivals' })).toHaveAttribute('href', '/route/OSW10?direction=FROM%20CAMPUS');
});
