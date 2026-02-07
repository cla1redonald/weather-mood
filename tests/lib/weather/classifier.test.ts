import { describe, it, expect } from 'vitest';
import { classifyWeather } from '@/lib/weather/classifier';

describe('classifyWeather', () => {
  describe('storm conditions', () => {
    it('should classify code 95 as storm', () => {
      expect(classifyWeather(95, 20)).toBe('storm');
    });

    it('should classify code 96 as storm', () => {
      expect(classifyWeather(96, 30)).toBe('storm');
    });

    it('should classify code 99 as storm', () => {
      expect(classifyWeather(99, 50)).toBe('storm');
    });
  });

  describe('snow conditions', () => {
    it('should classify code 71 as snow', () => {
      expect(classifyWeather(71, 10)).toBe('snow');
    });

    it('should classify code 75 as snow', () => {
      expect(classifyWeather(75, 15)).toBe('snow');
    });

    it('should classify code 77 as snow', () => {
      expect(classifyWeather(77, 20)).toBe('snow');
    });

    it('should classify code 85 (snow shower) as snow', () => {
      expect(classifyWeather(85, 10)).toBe('snow');
    });

    it('should classify code 86 (snow shower) as snow', () => {
      expect(classifyWeather(86, 15)).toBe('snow');
    });
  });

  describe('rain conditions', () => {
    it('should classify code 51 (drizzle) as rain', () => {
      expect(classifyWeather(51, 10)).toBe('rain');
    });

    it('should classify code 61 (rain) as rain', () => {
      expect(classifyWeather(61, 15)).toBe('rain');
    });

    it('should classify code 65 (heavy rain) as rain', () => {
      expect(classifyWeather(65, 25)).toBe('rain');
    });

    it('should classify code 80 (rain shower) as rain', () => {
      expect(classifyWeather(80, 20)).toBe('rain');
    });

    it('should classify code 82 (heavy rain shower) as rain', () => {
      expect(classifyWeather(82, 30)).toBe('rain');
    });
  });

  describe('cloudy conditions', () => {
    it('should classify code 45 (fog) as cloudy', () => {
      expect(classifyWeather(45, 5)).toBe('cloudy');
    });

    it('should classify code 48 (fog) as cloudy', () => {
      expect(classifyWeather(48, 10)).toBe('cloudy');
    });

    it('should classify unknown code as cloudy (default)', () => {
      expect(classifyWeather(999, 10)).toBe('cloudy');
    });
  });

  describe('clear conditions', () => {
    it('should classify code 0 with low wind as clear', () => {
      expect(classifyWeather(0, 10)).toBe('clear');
    });

    it('should classify code 1 with low wind as clear', () => {
      expect(classifyWeather(1, 20)).toBe('clear');
    });

    it('should classify code 2 with low wind as clear', () => {
      expect(classifyWeather(2, 30)).toBe('clear');
    });

    it('should classify code 3 with low wind as clear', () => {
      expect(classifyWeather(3, 35)).toBe('clear');
    });
  });

  describe('wind conditions', () => {
    it('should classify code 0 with high wind (>40 km/h) as wind', () => {
      expect(classifyWeather(0, 45)).toBe('wind');
    });

    it('should classify code 1 with high wind as wind', () => {
      expect(classifyWeather(1, 50)).toBe('wind');
    });

    it('should classify code 2 with high wind as wind', () => {
      expect(classifyWeather(2, 60)).toBe('wind');
    });

    it('should classify code 3 with exactly 41 km/h as wind', () => {
      expect(classifyWeather(3, 41)).toBe('wind');
    });

    it('should classify code 0 with exactly 40 km/h as clear (not wind)', () => {
      expect(classifyWeather(0, 40)).toBe('clear');
    });
  });
});
