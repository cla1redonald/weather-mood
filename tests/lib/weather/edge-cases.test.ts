import { describe, it, expect } from 'vitest';
import { classifyWeather } from '@/lib/weather/classifier';
import { normalizeParams } from '@/lib/weather/params';
import type { WeatherData } from '@/types/weather';

describe('Weather Edge Cases', () => {
  describe('classifyWeather edge cases', () => {
    it('handles undefined weatherCode gracefully', () => {
      // @ts-expect-error Testing runtime edge case
      const result = classifyWeather(undefined, 10);
      // undefined >= 0 is false, so falls through to default cloudy
      expect(result).toBe('cloudy');
    });

    it('handles null weatherCode', () => {
      // @ts-expect-error Testing runtime edge case
      const result = classifyWeather(null, 10);
      // In JavaScript, null >= 0 is true! So null falls into 0-3 range = 'clear'
      expect(result).toBe('clear');
    });

    it('handles negative weatherCode', () => {
      const result = classifyWeather(-1, 10);
      expect(result).toBe('cloudy');
    });

    it('handles very high weatherCode', () => {
      const result = classifyWeather(9999, 10);
      expect(result).toBe('cloudy');
    });

    it('handles negative windSpeed', () => {
      const result = classifyWeather(1, -20);
      // Should still classify as clear (negative wind doesn't trigger wind condition)
      expect(result).toBe('clear');
    });

    it('handles zero windSpeed', () => {
      const result = classifyWeather(1, 0);
      expect(result).toBe('clear');
    });

    it('handles very high windSpeed', () => {
      const result = classifyWeather(1, 200);
      expect(result).toBe('wind');
    });

    it('handles boundary windSpeed (exactly 40 km/h)', () => {
      const result = classifyWeather(1, 40);
      expect(result).toBe('clear'); // >40, not >=40
    });

    it('handles windSpeed just above threshold', () => {
      const result = classifyWeather(1, 40.1);
      expect(result).toBe('wind');
    });
  });

  describe('normalizeParams edge cases', () => {
    const createWeatherData = (overrides: Partial<WeatherData>): WeatherData => ({
      temperature: 15,
      windSpeed: 10,
      windDirection: 180,
      humidity: 50,
      cloudCover: 50,
      weatherCode: 2,
      uvIndex: 3,
      condition: 'clear',
      ...overrides,
    });

    it('handles extremely cold temperature (-50°C)', () => {
      const weather = createWeatherData({ temperature: -50 });
      const params = normalizeParams(weather);

      expect(params.temperature).toBe(0);
      expect(params.temperature).toBeGreaterThanOrEqual(0);
      expect(params.temperature).toBeLessThanOrEqual(1);
    });

    it('handles extremely hot temperature (60°C)', () => {
      const weather = createWeatherData({ temperature: 60 });
      const params = normalizeParams(weather);

      expect(params.temperature).toBe(1);
      expect(params.temperature).toBeGreaterThanOrEqual(0);
      expect(params.temperature).toBeLessThanOrEqual(1);
    });

    it('handles temperature beyond upper bound (100°C)', () => {
      const weather = createWeatherData({ temperature: 100 });
      const params = normalizeParams(weather);

      // Should clamp to 1.0
      expect(params.temperature).toBe(1);
    });

    it('handles temperature beyond lower bound (-100°C)', () => {
      const weather = createWeatherData({ temperature: -100 });
      const params = normalizeParams(weather);

      // Should clamp to 0.0
      expect(params.temperature).toBe(0);
    });

    it('handles zero temperature (freezing point)', () => {
      const weather = createWeatherData({ temperature: 0 });
      const params = normalizeParams(weather);

      // 0°C in range -20 to 45 = 20/65 ≈ 0.31
      expect(params.temperature).toBeCloseTo(0.31, 2);
    });

    it('handles negative windSpeed', () => {
      const weather = createWeatherData({ windSpeed: -10 });
      const params = normalizeParams(weather);

      // Should clamp to 0
      expect(params.windSpeed).toBe(0);
      expect(params.windSpeed).toBeGreaterThanOrEqual(0);
    });

    it('handles zero windSpeed', () => {
      const weather = createWeatherData({ windSpeed: 0 });
      const params = normalizeParams(weather);

      expect(params.windSpeed).toBe(0);
    });

    it('handles extremely high windSpeed (200 km/h)', () => {
      const weather = createWeatherData({ windSpeed: 200 });
      const params = normalizeParams(weather);

      // Should clamp to 1.0
      expect(params.windSpeed).toBe(1);
    });

    it('handles zero humidity', () => {
      const weather = createWeatherData({ humidity: 0 });
      const params = normalizeParams(weather);

      expect(params.humidity).toBe(0);
    });

    it('handles 100% humidity', () => {
      const weather = createWeatherData({ humidity: 100 });
      const params = normalizeParams(weather);

      expect(params.humidity).toBe(1);
    });

    it('handles negative humidity', () => {
      const weather = createWeatherData({ humidity: -10 });
      const params = normalizeParams(weather);

      expect(params.humidity).toBe(0);
    });

    it('handles humidity over 100', () => {
      const weather = createWeatherData({ humidity: 150 });
      const params = normalizeParams(weather);

      expect(params.humidity).toBe(1);
    });

    it('handles zero cloudCover', () => {
      const weather = createWeatherData({ cloudCover: 0 });
      const params = normalizeParams(weather);

      expect(params.cloudCover).toBe(0);
    });

    it('handles 100% cloudCover', () => {
      const weather = createWeatherData({ cloudCover: 100 });
      const params = normalizeParams(weather);

      expect(params.cloudCover).toBe(1);
    });

    it('handles negative cloudCover', () => {
      const weather = createWeatherData({ cloudCover: -20 });
      const params = normalizeParams(weather);

      expect(params.cloudCover).toBe(0);
    });

    it('handles cloudCover over 100', () => {
      const weather = createWeatherData({ cloudCover: 150 });
      const params = normalizeParams(weather);

      expect(params.cloudCover).toBe(1);
    });

    it('handles all parameters at minimum values', () => {
      const weather = createWeatherData({
        temperature: -50,
        windSpeed: 0,
        humidity: 0,
        cloudCover: 0,
      });
      const params = normalizeParams(weather);

      expect(params.temperature).toBe(0);
      expect(params.windSpeed).toBe(0);
      expect(params.humidity).toBe(0);
      expect(params.cloudCover).toBe(0);
    });

    it('handles all parameters at maximum values', () => {
      const weather = createWeatherData({
        temperature: 60,
        windSpeed: 100,
        humidity: 100,
        cloudCover: 100,
      });
      const params = normalizeParams(weather);

      expect(params.temperature).toBe(1);
      expect(params.windSpeed).toBe(1);
      expect(params.humidity).toBe(1);
      expect(params.cloudCover).toBe(1);
    });

    it('handles fractional values correctly', () => {
      const weather = createWeatherData({
        temperature: 15.7,
        windSpeed: 23.4,
        humidity: 67.8,
        cloudCover: 45.2,
      });
      const params = normalizeParams(weather);

      // All should be in valid range
      expect(params.temperature).toBeGreaterThanOrEqual(0);
      expect(params.temperature).toBeLessThanOrEqual(1);
      expect(params.windSpeed).toBeGreaterThanOrEqual(0);
      expect(params.windSpeed).toBeLessThanOrEqual(1);
      expect(params.humidity).toBeCloseTo(0.678, 2);
      expect(params.cloudCover).toBeCloseTo(0.452, 2);
    });
  });
});
