import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import WeatherInfo from '@/components/WeatherInfo';
import type { WeatherData } from '@/types/weather';

describe('WeatherInfo Component', () => {
  const mockWeatherData: WeatherData = {
    temperature: 22.5,
    windSpeed: 15.3,
    windDirection: 180,
    humidity: 65,
    cloudCover: 45,
    weatherCode: 2,
    uvIndex: 3.2,
    condition: 'clear',
    sunrise: '2026-02-07T06:45',
    sunset: '2026-02-07T17:30',
    utcOffsetSeconds: 3600,
  };

  const defaultProps = {
    countryCode: null as string | null,
    languageCode: null as string | null,
  };

  it('renders nothing when no weather and not loading', () => {
    const { container } = render(<WeatherInfo weather={null} isLoading={false} {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows loading state with skeleton', () => {
    render(<WeatherInfo weather={null} isLoading={true} {...defaultProps} />);
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('displays temperature rounded to nearest integer', () => {
    render(<WeatherInfo weather={mockWeatherData} isLoading={false} {...defaultProps} />);
    expect(screen.getByText('23°C')).toBeInTheDocument(); // 22.5 rounds to 23
  });

  it('displays condition label with capitalized first letter', () => {
    render(<WeatherInfo weather={mockWeatherData} isLoading={false} {...defaultProps} />);
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('handles negative temperatures', () => {
    const coldWeather: WeatherData = {
      ...mockWeatherData,
      temperature: -5.7,
    };
    render(<WeatherInfo weather={coldWeather} isLoading={false} {...defaultProps} />);
    expect(screen.getByText('-6°C')).toBeInTheDocument();
  });

  it('handles high temperatures', () => {
    const hotWeather: WeatherData = {
      ...mockWeatherData,
      temperature: 38.2,
    };
    render(<WeatherInfo weather={hotWeather} isLoading={false} {...defaultProps} />);
    expect(screen.getByText('38°C')).toBeInTheDocument();
  });

  it('handles different weather conditions', () => {
    const conditions: Array<{ condition: WeatherData['condition']; label: string }> = [
      { condition: 'rain', label: 'Rain' },
      { condition: 'snow', label: 'Snow' },
      { condition: 'storm', label: 'Storm' },
      { condition: 'cloudy', label: 'Cloudy' },
      { condition: 'wind', label: 'Wind' },
    ];

    conditions.forEach(({ condition, label }) => {
      const weather: WeatherData = { ...mockWeatherData, condition };
      const { rerender } = render(<WeatherInfo weather={weather} isLoading={false} {...defaultProps} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      rerender(<WeatherInfo weather={null} isLoading={false} {...defaultProps} />);
    });
  });

  it('has proper ARIA attributes for accessibility', () => {
    render(<WeatherInfo weather={mockWeatherData} isLoading={false} {...defaultProps} />);
    const element = screen.getByRole('status');
    expect(element).toHaveAttribute('aria-live', 'polite');
    expect(element).toHaveAttribute('aria-label', 'Current weather: 23 degrees Celsius, Clear');
  });

  it('rounds temperatures correctly', () => {
    const testCases = [
      { temp: 0.4, expected: '0°C' },
      { temp: 0.5, expected: '1°C' },
      { temp: -0.4, expected: '0°C' },
      { temp: -0.5, expected: '0°C' },
      { temp: 15.49, expected: '15°C' },
      { temp: 15.51, expected: '16°C' },
    ];

    testCases.forEach(({ temp, expected }) => {
      const weather: WeatherData = { ...mockWeatherData, temperature: temp };
      const { rerender } = render(<WeatherInfo weather={weather} isLoading={false} {...defaultProps} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
      rerender(<WeatherInfo weather={null} isLoading={false} {...defaultProps} />);
    });
  });
});
