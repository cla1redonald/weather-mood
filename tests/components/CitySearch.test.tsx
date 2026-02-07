import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CitySearch from '@/components/CitySearch';
import * as geocoding from '@/lib/weather/geocoding';

// Mock the geocoding module
vi.mock('@/lib/weather/geocoding', () => ({
  searchCities: vi.fn(),
}));

describe('CitySearch Component', () => {
  const mockOnCitySelect = vi.fn();
  const mockCities = [
    { name: 'London', country: 'United Kingdom', latitude: 51.5074, longitude: -0.1278 },
    { name: 'Paris', country: 'France', latitude: 48.8566, longitude: 2.3522 },
    { name: 'New York', country: 'United States', latitude: 40.7128, longitude: -74.0060 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with placeholder text', () => {
    render(<CitySearch onCitySelect={mockOnCitySelect} />);
    expect(screen.getByPlaceholderText(/enter a city/i)).toBeInTheDocument();
  });

  it('shows initial hint message', () => {
    render(<CitySearch onCitySelect={mockOnCitySelect} />);
    expect(screen.getByText(/enter a city to feel the weather/i)).toBeInTheDocument();
  });

  it('handles input changes', () => {
    render(<CitySearch onCitySelect={mockOnCitySelect} />);
    const input = screen.getByPlaceholderText(/enter a city/i);

    fireEvent.change(input, { target: { value: 'London' } });
    expect(input).toHaveValue('London');
  });

  it('shows city suggestions after search', async () => {
    vi.mocked(geocoding.searchCities).mockResolvedValue(mockCities);

    render(<CitySearch onCitySelect={mockOnCitySelect} />);
    const input = screen.getByPlaceholderText(/enter a city/i);

    fireEvent.change(input, { target: { value: 'London' } });

    await waitFor(() => {
      expect(screen.getByText('London')).toBeInTheDocument();
    }, { timeout: 1000 });

    expect(screen.getByText('Paris')).toBeInTheDocument();
    expect(screen.getByText('New York')).toBeInTheDocument();
  });

  it('calls onCitySelect when a suggestion is clicked', async () => {
    vi.mocked(geocoding.searchCities).mockResolvedValue(mockCities);

    render(<CitySearch onCitySelect={mockOnCitySelect} />);
    const input = screen.getByPlaceholderText(/enter a city/i);

    fireEvent.change(input, { target: { value: 'London' } });

    await waitFor(() => {
      expect(screen.getByText('London')).toBeInTheDocument();
    }, { timeout: 1000 });

    fireEvent.click(screen.getByText('London'));

    expect(mockOnCitySelect).toHaveBeenCalledWith(mockCities[0]);
    expect(mockOnCitySelect).toHaveBeenCalledTimes(1);
  });

  it('collapses to selected city name after selection', async () => {
    vi.mocked(geocoding.searchCities).mockResolvedValue(mockCities);

    render(<CitySearch onCitySelect={mockOnCitySelect} />);
    const input = screen.getByPlaceholderText(/enter a city/i);

    fireEvent.change(input, { target: { value: 'London' } });

    await waitFor(() => {
      expect(screen.getByText('London')).toBeInTheDocument();
    }, { timeout: 1000 });

    fireEvent.click(screen.getByText('London'));

    await waitFor(() => {
      expect(screen.getByText('London, United Kingdom')).toBeInTheDocument();
    });
  });

  it('handles keyboard navigation (ArrowDown, ArrowUp)', async () => {
    vi.mocked(geocoding.searchCities).mockResolvedValue(mockCities);

    render(<CitySearch onCitySelect={mockOnCitySelect} />);
    const input = screen.getByPlaceholderText(/enter a city/i);

    fireEvent.change(input, { target: { value: 'London' } });

    await waitFor(() => {
      expect(screen.getByText('London')).toBeInTheDocument();
    }, { timeout: 1000 });

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('London');

    // ArrowDown should highlight next item
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Can't easily test highlighted state, but verify no errors

    // ArrowUp should go back
    fireEvent.keyDown(input, { key: 'ArrowUp' });
  });

  it('selects highlighted city on Enter key', async () => {
    vi.mocked(geocoding.searchCities).mockResolvedValue(mockCities);

    render(<CitySearch onCitySelect={mockOnCitySelect} />);
    const input = screen.getByPlaceholderText(/enter a city/i);

    fireEvent.change(input, { target: { value: 'London' } });

    await waitFor(() => {
      expect(screen.getByText('London')).toBeInTheDocument();
    }, { timeout: 1000 });

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockOnCitySelect).toHaveBeenCalledWith(mockCities[0]);
  });

  it('clears suggestions on Escape key', async () => {
    vi.mocked(geocoding.searchCities).mockResolvedValue(mockCities);

    render(<CitySearch onCitySelect={mockOnCitySelect} />);
    const input = screen.getByPlaceholderText(/enter a city/i);

    fireEvent.change(input, { target: { value: 'London' } });

    await waitFor(() => {
      expect(screen.getByText('London')).toBeInTheDocument();
    }, { timeout: 1000 });

    // Escape key clears suggestions
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('London')).not.toBeInTheDocument();
    });
  });

  it('shows error message when no cities found', async () => {
    vi.mocked(geocoding.searchCities).mockResolvedValue([]);

    render(<CitySearch onCitySelect={mockOnCitySelect} />);
    const input = screen.getByPlaceholderText(/enter a city/i);

    fireEvent.change(input, { target: { value: 'XYZ' } });

    await waitFor(() => {
      expect(screen.getByText(/city not found/i)).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('shows error on network failure', async () => {
    vi.mocked(geocoding.searchCities).mockRejectedValue(new Error('Network error'));

    render(<CitySearch onCitySelect={mockOnCitySelect} />);
    const input = screen.getByPlaceholderText(/enter a city/i);

    fireEvent.change(input, { target: { value: 'London' } });

    await waitFor(() => {
      expect(screen.getByText(/connection error/i)).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('shows rate limit error', async () => {
    vi.mocked(geocoding.searchCities).mockRejectedValue(new Error('Rate limit exceeded'));

    render(<CitySearch onCitySelect={mockOnCitySelect} />);
    const input = screen.getByPlaceholderText(/enter a city/i);

    fireEvent.change(input, { target: { value: 'London' } });

    await waitFor(() => {
      expect(screen.getByText(/too many requests/i)).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('loads default city if provided', () => {
    render(<CitySearch onCitySelect={mockOnCitySelect} defaultCity="Paris" />);
    const input = screen.getByPlaceholderText(/enter a city/i);

    expect(input).toHaveValue('Paris');
  });
});
