import { describe, it, expect } from 'vitest';
import { normalizeParams } from '@/lib/weather/params';
import { WeatherData } from '@/types/weather';

describe('normalizeParams', () => {
  describe('temperature normalization', () => {
    it('should normalize -20°C to 0.0', () => {
      const weather: WeatherData = {
        temperature: -20,
        humidity: 50,
        windSpeed: 10,
        windDirection: 180,
        cloudCover: 50,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.temperature).toBe(0.0);
    });

    it('should normalize 45°C to 1.0', () => {
      const weather: WeatherData = {
        temperature: 45,
        humidity: 50,
        windSpeed: 10,
        windDirection: 180,
        cloudCover: 50,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.temperature).toBe(1.0);
    });

    it('should normalize 12.5°C to 0.5 (midpoint)', () => {
      const weather: WeatherData = {
        temperature: 12.5,
        humidity: 50,
        windSpeed: 10,
        windDirection: 180,
        cloudCover: 50,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.temperature).toBe(0.5);
    });

    it('should clamp temperature below -20°C to 0.0', () => {
      const weather: WeatherData = {
        temperature: -50,
        humidity: 50,
        windSpeed: 10,
        windDirection: 180,
        cloudCover: 50,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.temperature).toBe(0.0);
    });

    it('should clamp temperature above 45°C to 1.0', () => {
      const weather: WeatherData = {
        temperature: 60,
        humidity: 50,
        windSpeed: 10,
        windDirection: 180,
        cloudCover: 50,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.temperature).toBe(1.0);
    });
  });

  describe('humidity normalization', () => {
    it('should normalize 0% humidity to 0.0', () => {
      const weather: WeatherData = {
        temperature: 20,
        humidity: 0,
        windSpeed: 10,
        windDirection: 180,
        cloudCover: 50,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.humidity).toBe(0.0);
    });

    it('should normalize 100% humidity to 1.0', () => {
      const weather: WeatherData = {
        temperature: 20,
        humidity: 100,
        windSpeed: 10,
        windDirection: 180,
        cloudCover: 50,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.humidity).toBe(1.0);
    });

    it('should normalize 50% humidity to 0.5', () => {
      const weather: WeatherData = {
        temperature: 20,
        humidity: 50,
        windSpeed: 10,
        windDirection: 180,
        cloudCover: 50,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.humidity).toBe(0.5);
    });

    it('should clamp humidity above 100% to 1.0', () => {
      const weather: WeatherData = {
        temperature: 20,
        humidity: 150,
        windSpeed: 10,
        windDirection: 180,
        cloudCover: 50,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.humidity).toBe(1.0);
    });
  });

  describe('wind speed normalization', () => {
    it('should normalize 0 km/h to 0.0', () => {
      const weather: WeatherData = {
        temperature: 20,
        humidity: 50,
        windSpeed: 0,
        windDirection: 180,
        cloudCover: 50,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.windSpeed).toBe(0.0);
    });

    it('should normalize 100 km/h to 1.0', () => {
      const weather: WeatherData = {
        temperature: 20,
        humidity: 50,
        windSpeed: 100,
        windDirection: 180,
        cloudCover: 50,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.windSpeed).toBe(1.0);
    });

    it('should normalize 50 km/h to 0.5', () => {
      const weather: WeatherData = {
        temperature: 20,
        humidity: 50,
        windSpeed: 50,
        windDirection: 180,
        cloudCover: 50,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.windSpeed).toBe(0.5);
    });

    it('should clamp wind speed above 100 km/h to 1.0', () => {
      const weather: WeatherData = {
        temperature: 20,
        humidity: 50,
        windSpeed: 150,
        windDirection: 180,
        cloudCover: 50,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.windSpeed).toBe(1.0);
    });
  });

  describe('cloud cover normalization', () => {
    it('should normalize 0% cloud cover to 0.0', () => {
      const weather: WeatherData = {
        temperature: 20,
        humidity: 50,
        windSpeed: 10,
        windDirection: 180,
        cloudCover: 0,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.cloudCover).toBe(0.0);
    });

    it('should normalize 100% cloud cover to 1.0', () => {
      const weather: WeatherData = {
        temperature: 20,
        humidity: 50,
        windSpeed: 10,
        windDirection: 180,
        cloudCover: 100,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.cloudCover).toBe(1.0);
    });

    it('should normalize 50% cloud cover to 0.5', () => {
      const weather: WeatherData = {
        temperature: 20,
        humidity: 50,
        windSpeed: 10,
        windDirection: 180,
        cloudCover: 50,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.cloudCover).toBe(0.5);
    });

    it('should clamp cloud cover above 100% to 1.0', () => {
      const weather: WeatherData = {
        temperature: 20,
        humidity: 50,
        windSpeed: 10,
        windDirection: 180,
        cloudCover: 120,
        weatherCode: 0,
        uvIndex: 5,
        condition: 'clear',
      };
      const result = normalizeParams(weather);
      expect(result.cloudCover).toBe(1.0);
    });
  });

  describe('all parameters together', () => {
    it('should correctly normalize a realistic weather snapshot', () => {
      const weather: WeatherData = {
        temperature: 22, // 22°C should be (22 - (-20)) / (45 - (-20)) = 42/65 ≈ 0.646
        humidity: 75,    // 75% should be 0.75
        windSpeed: 35,   // 35 km/h should be 0.35
        windDirection: 270,
        cloudCover: 60,  // 60% should be 0.6
        weatherCode: 61,
        uvIndex: 5,
        condition: 'rain',
      };
      const result = normalizeParams(weather);

      expect(result.temperature).toBeCloseTo(0.646, 2);
      expect(result.humidity).toBe(0.75);
      expect(result.windSpeed).toBe(0.35);
      expect(result.cloudCover).toBe(0.6);
    });
  });
});
