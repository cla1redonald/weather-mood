import { describe, it, expect } from 'vitest';
import { getMaxParticles } from '@/lib/canvas/particles';
import { getPalette, buildBackgroundGradient } from '@/lib/canvas/palette';
import type { WeatherCondition, NormalizedParams } from '@/types/weather';

describe('getMaxParticles', () => {
  const conditions: WeatherCondition[] = ['rain', 'snow', 'clear', 'cloudy', 'storm', 'wind'];

  it('returns desktop counts for wide viewports', () => {
    const expected: Record<WeatherCondition, number> = {
      rain: 300,
      snow: 200,
      clear: 250,
      cloudy: 100,
      storm: 400,
      wind: 300,
    };
    for (const c of conditions) {
      expect(getMaxParticles(1920, c)).toBe(expected[c]);
    }
  });

  it('returns mobile counts for narrow viewports', () => {
    const expected: Record<WeatherCondition, number> = {
      rain: 150,
      snow: 100,
      clear: 120,
      cloudy: 50,
      storm: 200,
      wind: 150,
    };
    for (const c of conditions) {
      expect(getMaxParticles(375, c)).toBe(expected[c]);
    }
  });

  it('treats 768px as mobile (< 768)', () => {
    expect(getMaxParticles(767, 'rain')).toBe(150);
  });

  it('treats 768px as desktop (>= 768)', () => {
    expect(getMaxParticles(768, 'rain')).toBe(300);
  });

  it('storm has the highest particle count', () => {
    for (const width of [375, 1920]) {
      const counts = conditions.map(c => getMaxParticles(width, c));
      const stormCount = getMaxParticles(width, 'storm');
      expect(stormCount).toBe(Math.max(...counts));
    }
  });

  it('cloudy has the lowest particle count', () => {
    for (const width of [375, 1920]) {
      const counts = conditions.map(c => getMaxParticles(width, c));
      const cloudyCount = getMaxParticles(width, 'cloudy');
      expect(cloudyCount).toBe(Math.min(...counts));
    }
  });
});

describe('weather-to-visual parameter mapping', () => {
  it('temperature affects background gradient color', () => {
    const palette = getPalette('rain');
    const cold: NormalizedParams = { temperature: 0, humidity: 0.5, windSpeed: 0.5, cloudCover: 0.5 };
    const hot: NormalizedParams = { temperature: 1, humidity: 0.5, windSpeed: 0.5, cloudCover: 0.5 };

    const coldGradient = buildBackgroundGradient(palette, cold);
    const hotGradient = buildBackgroundGradient(palette, hot);

    // Gradients should differ with different temperatures
    expect(coldGradient.top).not.toBe(hotGradient.top);
  });

  it('all 6 weather modes produce distinct palettes', () => {
    const conditions: WeatherCondition[] = ['rain', 'snow', 'clear', 'cloudy', 'storm', 'wind'];
    const palettes = conditions.map(c => getPalette(c));

    // Each palette should have unique background colors
    const backgroundStrings = palettes.map(p =>
      JSON.stringify(p.background),
    );
    const unique = new Set(backgroundStrings);
    expect(unique.size).toBe(6);
  });

  it('each mode palette has at least 2 background colors and 3 particle colors', () => {
    const conditions: WeatherCondition[] = ['rain', 'snow', 'clear', 'cloudy', 'storm', 'wind'];
    for (const c of conditions) {
      const palette = getPalette(c);
      expect(palette.background.length).toBeGreaterThanOrEqual(2);
      expect(palette.particles.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('normalized params at boundaries (0 and 1) produce valid gradients', () => {
    const conditions: WeatherCondition[] = ['rain', 'snow', 'clear', 'cloudy', 'storm', 'wind'];
    const extremes: NormalizedParams[] = [
      { temperature: 0, humidity: 0, windSpeed: 0, cloudCover: 0 },
      { temperature: 1, humidity: 1, windSpeed: 1, cloudCover: 1 },
      { temperature: 0.5, humidity: 0.5, windSpeed: 0.5, cloudCover: 0.5 },
    ];

    for (const c of conditions) {
      const palette = getPalette(c);
      for (const params of extremes) {
        const result = buildBackgroundGradient(palette, params);
        expect(result.top).toBeTruthy();
        expect(result.bottom).toBeTruthy();
        // Should be valid rgba strings
        expect(result.top).toMatch(/^rgba\(/);
        expect(result.bottom).toMatch(/^rgba\(/);
      }
    }
  });
});
