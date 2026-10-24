import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';

test('identifies Arrivals as the current destination on a route detail screen', () => {
  render(<MemoryRouter initialEntries={['/route/OSW10']}><Navbar /></MemoryRouter>);
  const nav = within(screen.getByRole('navigation', { name: 'Mobile navigation' }));
  expect(nav.getAllByRole('link')).toHaveLength(5);
  expect(nav.getByRole('link', { name: 'Arrivals' })).toHaveAttribute('aria-current', 'page');
  expect(nav.getByRole('link', { name: 'Live map' })).toHaveAttribute('href', '/tracker');
  expect(nav.getByRole('link', { name: 'Active' })).toHaveAttribute('href', '/active');
  expect(nav.getByRole('link', { name: 'Schedules' })).toHaveAttribute('href', '/schedule');
  expect(nav.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
});
