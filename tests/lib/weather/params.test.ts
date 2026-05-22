import { describe, it, expect } from 'vitest';
import { normalizeParams } from '@/lib/weather/params';
import { WeatherData } from '@/types/weather';

function createWeather(overrides: Partial<WeatherData> = {}): WeatherData {
  return {
    temperature: 20,
    humidity: 50,
    windSpeed: 10,
    windDirection: 180,
    cloudCover: 50,
    weatherCode: 0,
    uvIndex: 5,
    condition: 'clear',
    sunrise: '2026-05-22T05:00',
    sunset: '2026-05-22T21:00',
    utcOffsetSeconds: 0,
    ...overrides,
  };
}

describe('normalizeParams', () => {
  describe('temperature normalization', () => {
    it('should normalize -20°C to 0.0', () => {
      expect(normalizeParams(createWeather({ temperature: -20 })).temperature).toBe(0.0);
    });

    it('should normalize 45°C to 1.0', () => {
      expect(normalizeParams(createWeather({ temperature: 45 })).temperature).toBe(1.0);
    });

    it('should normalize 12.5°C to 0.5 (midpoint)', () => {
      expect(normalizeParams(createWeather({ temperature: 12.5 })).temperature).toBe(0.5);
    });

    it('should clamp temperature below -20°C to 0.0', () => {
      expect(normalizeParams(createWeather({ temperature: -50 })).temperature).toBe(0.0);
    });

    it('should clamp temperature above 45°C to 1.0', () => {
      expect(normalizeParams(createWeather({ temperature: 60 })).temperature).toBe(1.0);
    });
  });

  describe('humidity normalization', () => {
    it('should normalize 0% humidity to 0.0', () => {
      expect(normalizeParams(createWeather({ humidity: 0 })).humidity).toBe(0.0);
    });

    it('should normalize 100% humidity to 1.0', () => {
      expect(normalizeParams(createWeather({ humidity: 100 })).humidity).toBe(1.0);
    });

    it('should normalize 50% humidity to 0.5', () => {
      expect(normalizeParams(createWeather({ humidity: 50 })).humidity).toBe(0.5);
    });

    it('should clamp humidity above 100% to 1.0', () => {
      expect(normalizeParams(createWeather({ humidity: 150 })).humidity).toBe(1.0);
    });
  });

  describe('wind speed normalization', () => {
    it('should normalize 0 km/h to 0.0', () => {
      expect(normalizeParams(createWeather({ windSpeed: 0 })).windSpeed).toBe(0.0);
    });

    it('should normalize 100 km/h to 1.0', () => {
      expect(normalizeParams(createWeather({ windSpeed: 100 })).windSpeed).toBe(1.0);
    });

    it('should normalize 50 km/h to 0.5', () => {
      expect(normalizeParams(createWeather({ windSpeed: 50 })).windSpeed).toBe(0.5);
    });

    it('should clamp wind speed above 100 km/h to 1.0', () => {
      expect(normalizeParams(createWeather({ windSpeed: 150 })).windSpeed).toBe(1.0);
    });
  });

  describe('cloud cover normalization', () => {
    it('should normalize 0% cloud cover to 0.0', () => {
      expect(normalizeParams(createWeather({ cloudCover: 0 })).cloudCover).toBe(0.0);
    });

    it('should normalize 100% cloud cover to 1.0', () => {
      expect(normalizeParams(createWeather({ cloudCover: 100 })).cloudCover).toBe(1.0);
    });

    it('should normalize 50% cloud cover to 0.5', () => {
      expect(normalizeParams(createWeather({ cloudCover: 50 })).cloudCover).toBe(0.5);
    });

    it('should clamp cloud cover above 100% to 1.0', () => {
      expect(normalizeParams(createWeather({ cloudCover: 120 })).cloudCover).toBe(1.0);
    });
  });

  describe('all parameters together', () => {
    it('should correctly normalize a realistic weather snapshot', () => {
      const weather = createWeather({
        temperature: 22, // (22 - (-20)) / (45 - (-20)) = 42/65 ≈ 0.646
        humidity: 75,
        windSpeed: 35,
        windDirection: 270,
        cloudCover: 60,
        weatherCode: 61,
        condition: 'rain',
      });
      const result = normalizeParams(weather);

      expect(result.temperature).toBeCloseTo(0.646, 2);
      expect(result.humidity).toBe(0.75);
      expect(result.windSpeed).toBe(0.35);
      expect(result.cloudCover).toBe(0.6);
    });
  });
});
