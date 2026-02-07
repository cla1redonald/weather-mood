import { describe, it, expect, vi } from 'vitest';
import { searchCities } from '@/lib/weather/geocoding';
import { fetchWeather } from '@/lib/weather/api';
import { normalizeParams } from '@/lib/weather/params';
import { classifyWeather } from '@/lib/weather/classifier';
import type { GeoLocation, WeatherData, NormalizedParams } from '@/types/weather';

// Mock the fetch API
global.fetch = vi.fn();

describe('Weather Data Pipeline Integration', () => {
  it('completes full pipeline: city search -> weather fetch -> classify -> normalize', async () => {
    // Mock geocoding response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            name: 'London',
            country: 'United Kingdom',
            latitude: 51.5074,
            longitude: -0.1278,
          },
        ],
      }),
    } as Response);

    // Step 1: Search for city
    const cities = await searchCities('London');
    expect(cities).toHaveLength(1);
    const city: GeoLocation = cities[0];
    expect(city.name).toBe('London');

    // Mock weather API response
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 18.5,
          wind_speed_10m: 22.3,
          wind_direction_10m: 225,
          relative_humidity_2m: 75,
          cloud_cover: 60,
          weather_code: 3,
          uv_index: 2.1,
        },
      }),
    } as Response);

    // Step 2: Fetch weather data
    const weather: WeatherData = await fetchWeather(city.latitude, city.longitude);
    expect(weather.temperature).toBe(18.5);
    expect(weather.windSpeed).toBe(22.3);
    expect(weather.weatherCode).toBe(3);

    // Step 3: Classify weather
    expect(weather.condition).toBe(classifyWeather(weather.weatherCode, weather.windSpeed));

    // Step 4: Normalize parameters
    const params: NormalizedParams = normalizeParams(weather);

    // Verify all normalized params are in 0-1 range
    expect(params.temperature).toBeGreaterThanOrEqual(0);
    expect(params.temperature).toBeLessThanOrEqual(1);
    expect(params.windSpeed).toBeGreaterThanOrEqual(0);
    expect(params.windSpeed).toBeLessThanOrEqual(1);
    expect(params.humidity).toBeGreaterThanOrEqual(0);
    expect(params.humidity).toBeLessThanOrEqual(1);
    expect(params.cloudCover).toBeGreaterThanOrEqual(0);
    expect(params.cloudCover).toBeLessThanOrEqual(1);

    // Verify temperature normalization (18.5°C should be around mid-range)
    expect(params.temperature).toBeGreaterThan(0.4);
    expect(params.temperature).toBeLessThan(0.7);

    // Verify wind normalization (22.3 km/h is low-medium)
    expect(params.windSpeed).toBeGreaterThan(0);
    expect(params.windSpeed).toBeLessThan(0.5);

    // Verify humidity normalization (75% is high)
    expect(params.humidity).toBe(0.75);

    // Verify cloud normalization (60% is medium-high)
    expect(params.cloudCover).toBe(0.6);
  });

  it('handles rainy weather conditions through full pipeline', async () => {
    // Mock geocoding
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ name: 'Seattle', country: 'United States', latitude: 47.6062, longitude: -122.3321 }],
      }),
    } as Response);

    const cities = await searchCities('Seattle');
    const city = cities[0];

    // Mock rainy weather (WMO code 61 = rain)
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 12.0,
          wind_speed_10m: 18.0,
          wind_direction_10m: 180,
          relative_humidity_2m: 90,
          cloud_cover: 100,
          weather_code: 61,
          uv_index: 0.5,
        },
      }),
    } as Response);

    const weather = await fetchWeather(city.latitude, city.longitude);
    const params = normalizeParams(weather);

    // Verify rain condition
    expect(weather.condition).toBe('rain');

    // Verify normalized params reflect rainy conditions
    expect(params.temperature).toBeLessThan(0.5); // Cool temperature
    expect(params.humidity).toBeGreaterThan(0.8); // High humidity
    expect(params.cloudCover).toBe(1.0); // Full cloud cover
  });

  it('handles snowy weather conditions through full pipeline', async () => {
    // Mock geocoding
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ name: 'Oslo', country: 'Norway', latitude: 59.9139, longitude: 10.7522 }],
      }),
    } as Response);

    const cities = await searchCities('Oslo');
    const city = cities[0];

    // Mock snowy weather (WMO code 73 = moderate snow)
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: -5.0,
          wind_speed_10m: 12.0,
          wind_direction_10m: 90,
          relative_humidity_2m: 85,
          cloud_cover: 95,
          weather_code: 73,
          uv_index: 0.2,
        },
      }),
    } as Response);

    const weather = await fetchWeather(city.latitude, city.longitude);
    const params = normalizeParams(weather);

    // Verify snow condition
    expect(weather.condition).toBe('snow');

    // Verify normalized params reflect snowy conditions
    expect(params.temperature).toBeLessThan(0.3); // Very cold
    expect(params.humidity).toBeGreaterThan(0.8); // High humidity
    expect(params.cloudCover).toBeGreaterThan(0.9); // Nearly full cloud cover
  });

  it('handles stormy weather conditions through full pipeline', async () => {
    // Mock geocoding
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ name: 'Miami', country: 'United States', latitude: 25.7617, longitude: -80.1918 }],
      }),
    } as Response);

    const cities = await searchCities('Miami');
    const city = cities[0];

    // Mock thunderstorm (WMO code 95 = thunderstorm)
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 28.0,
          wind_speed_10m: 45.0,
          wind_direction_10m: 270,
          relative_humidity_2m: 88,
          cloud_cover: 100,
          weather_code: 95,
          uv_index: 1.0,
        },
      }),
    } as Response);

    const weather = await fetchWeather(city.latitude, city.longitude);
    const params = normalizeParams(weather);

    // Verify storm condition
    expect(weather.condition).toBe('storm');

    // Verify normalized params reflect stormy conditions
    expect(params.temperature).toBeGreaterThan(0.6); // Warm
    expect(params.windSpeed).toBeGreaterThan(0.4); // High wind (45 km/h / 100 = 0.45)
    expect(params.humidity).toBeGreaterThan(0.85); // Very high humidity
    expect(params.cloudCover).toBe(1.0); // Full cloud cover
  });

  it('handles windy conditions (clear sky but high wind)', async () => {
    // Mock geocoding
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ name: 'Chicago', country: 'United States', latitude: 41.8781, longitude: -87.6298 }],
      }),
    } as Response);

    const cities = await searchCities('Chicago');
    const city = cities[0];

    // Mock windy conditions (clear sky but >40 km/h wind)
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 15.0,
          wind_speed_10m: 55.0,
          wind_direction_10m: 315,
          relative_humidity_2m: 50,
          cloud_cover: 10,
          weather_code: 1,
          uv_index: 4.5,
        },
      }),
    } as Response);

    const weather = await fetchWeather(city.latitude, city.longitude);
    const params = normalizeParams(weather);

    // Verify wind condition (overrides clear due to high wind)
    expect(weather.condition).toBe('wind');

    // Verify normalized params
    expect(params.windSpeed).toBeGreaterThan(0.5); // Very high wind (55 km/h / 100 = 0.55)
    expect(params.cloudCover).toBeLessThan(0.2); // Low cloud cover
  });

  it('handles hot sunny conditions', async () => {
    // Mock geocoding
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ name: 'Dubai', country: 'United Arab Emirates', latitude: 25.2048, longitude: 55.2708 }],
      }),
    } as Response);

    const cities = await searchCities('Dubai');
    const city = cities[0];

    // Mock hot sunny weather
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 42.0,
          wind_speed_10m: 8.0,
          wind_direction_10m: 120,
          relative_humidity_2m: 25,
          cloud_cover: 5,
          weather_code: 0,
          uv_index: 9.5,
        },
      }),
    } as Response);

    const weather = await fetchWeather(city.latitude, city.longitude);
    const params = normalizeParams(weather);

    // Verify clear condition
    expect(weather.condition).toBe('clear');

    // Verify normalized params reflect hot sunny conditions
    expect(params.temperature).toBeGreaterThan(0.9); // Very hot
    expect(params.windSpeed).toBeLessThan(0.2); // Low wind
    expect(params.humidity).toBeLessThan(0.3); // Low humidity
    expect(params.cloudCover).toBeLessThan(0.1); // Almost no clouds
  });
});
