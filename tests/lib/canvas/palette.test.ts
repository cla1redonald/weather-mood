import { describe, it, expect } from 'vitest';
import {
  lerpColor,
  rgbaToString,
  getPalette,
  temperatureShift,
  buildBackgroundGradient,
  randomParticleColor,
  type RGBA,
} from '@/lib/canvas/palette';

describe('lerpColor', () => {
  it('returns the first color at t=0', () => {
    const a: RGBA = [0, 0, 0, 1];
    const b: RGBA = [255, 255, 255, 1];
    expect(lerpColor(a, b, 0)).toEqual([0, 0, 0, 1]);
  });

  it('returns the second color at t=1', () => {
    const a: RGBA = [0, 0, 0, 0];
    const b: RGBA = [255, 255, 255, 1];
    expect(lerpColor(a, b, 1)).toEqual([255, 255, 255, 1]);
  });

  it('returns midpoint at t=0.5', () => {
    const a: RGBA = [0, 0, 0, 0];
    const b: RGBA = [200, 100, 50, 1];
    const result = lerpColor(a, b, 0.5);
    expect(result[0]).toBe(100);
    expect(result[1]).toBe(50);
    expect(result[2]).toBe(25);
    expect(result[3]).toBeCloseTo(0.5);
  });

  it('clamps t below 0', () => {
    const a: RGBA = [100, 100, 100, 1];
    const b: RGBA = [200, 200, 200, 1];
    expect(lerpColor(a, b, -0.5)).toEqual([100, 100, 100, 1]);
  });

  it('clamps t above 1', () => {
    const a: RGBA = [100, 100, 100, 0.5];
    const b: RGBA = [200, 200, 200, 1];
    expect(lerpColor(a, b, 1.5)).toEqual([200, 200, 200, 1]);
  });

  it('handles alpha interpolation correctly', () => {
    const a: RGBA = [0, 0, 0, 0.2];
    const b: RGBA = [0, 0, 0, 0.8];
    const result = lerpColor(a, b, 0.5);
    expect(result[3]).toBeCloseTo(0.5);
  });
});

describe('rgbaToString', () => {
  it('formats a fully opaque color', () => {
    expect(rgbaToString([255, 128, 0, 1])).toBe('rgba(255,128,0,1)');
  });

  it('formats a semi-transparent color', () => {
    expect(rgbaToString([0, 0, 0, 0.5])).toBe('rgba(0,0,0,0.5)');
  });

  it('formats a fully transparent color', () => {
    expect(rgbaToString([100, 200, 50, 0])).toBe('rgba(100,200,50,0)');
  });
});

describe('getPalette', () => {
  it('returns a palette for each weather condition', () => {
    const conditions = ['rain', 'snow', 'clear', 'cloudy', 'storm', 'wind'];
    for (const condition of conditions) {
      const palette = getPalette(condition);
      expect(palette.background.length).toBeGreaterThan(0);
      expect(palette.particles.length).toBeGreaterThan(0);
    }
  });

  it('returns the clear palette for unknown conditions', () => {
    const palette = getPalette('unknown');
    const clearPalette = getPalette('clear');
    expect(palette).toEqual(clearPalette);
  });

  it('rain palette has cool blue tones', () => {
    const palette = getPalette('rain');
    // Rain particles should be blue-ish (higher blue channel)
    for (const color of palette.particles) {
      expect(color[2]).toBeGreaterThanOrEqual(color[0]); // blue >= red
    }
  });

  it('clear palette has warm amber tones', () => {
    const palette = getPalette('clear');
    // Clear particles should be warm (higher red channel)
    for (const color of palette.particles) {
      expect(color[0]).toBeGreaterThanOrEqual(color[2]); // red >= blue
    }
  });

  it('storm palette has dark backgrounds', () => {
    const palette = getPalette('storm');
    for (const bg of palette.background) {
      const brightness = (bg[0] + bg[1] + bg[2]) / 3;
      expect(brightness).toBeLessThan(50);
    }
  });
});

describe('temperatureShift', () => {
  it('shifts cold (0) toward blue', () => {
    const base: RGBA = [128, 128, 128, 1];
    const shifted = temperatureShift(base, 0);
    // Blue channel should increase relative to red
    expect(shifted[2]).toBeGreaterThan(shifted[0]);
  });

  it('shifts hot (1) toward amber', () => {
    const base: RGBA = [128, 128, 128, 1];
    const shifted = temperatureShift(base, 1);
    // Red channel should increase relative to blue
    expect(shifted[0]).toBeGreaterThan(shifted[2]);
  });

  it('keeps neutral (0.5) close to original', () => {
    const base: RGBA = [128, 128, 128, 1];
    const shifted = temperatureShift(base, 0.5);
    // Should be close to original
    expect(Math.abs(shifted[0] - 128)).toBeLessThan(20);
    expect(Math.abs(shifted[1] - 128)).toBeLessThan(20);
    expect(Math.abs(shifted[2] - 128)).toBeLessThan(20);
  });

  it('preserves alpha', () => {
    const base: RGBA = [100, 100, 100, 0.7];
    const shifted = temperatureShift(base, 0.3);
    expect(shifted[3]).toBeCloseTo(0.7, 1);
  });
});

describe('buildBackgroundGradient', () => {
  it('returns top and bottom gradient strings', () => {
    const palette = getPalette('rain');
    const params = { temperature: 0.5, humidity: 0.5, windSpeed: 0, cloudCover: 0 };
    const result = buildBackgroundGradient(palette, params);
    expect(result.top).toMatch(/^rgba\(\d+,\d+,\d+,[\d.]+\)$/);
    expect(result.bottom).toMatch(/^rgba\(\d+,\d+,\d+,[\d.]+\)$/);
  });

  it('warm temperature shifts gradient toward amber', () => {
    const palette = getPalette('clear');
    const coldResult = buildBackgroundGradient(palette, {
      temperature: 0, humidity: 0.5, windSpeed: 0, cloudCover: 0,
    });
    const warmResult = buildBackgroundGradient(palette, {
      temperature: 1, humidity: 0.5, windSpeed: 0, cloudCover: 0,
    });
    // The two should differ
    expect(coldResult.top).not.toBe(warmResult.top);
  });
});

describe('randomParticleColor', () => {
  it('returns a color from the palette particle set', () => {
    const palette = getPalette('rain');
    const color = randomParticleColor(palette);
    expect(color).toHaveLength(4);
    expect(palette.particles).toContainEqual(color);
  });

  it('works for all conditions', () => {
    const conditions = ['rain', 'snow', 'clear', 'cloudy', 'storm', 'wind'];
    for (const c of conditions) {
      const palette = getPalette(c);
      const color = randomParticleColor(palette);
      expect(color[0]).toBeGreaterThanOrEqual(0);
      expect(color[0]).toBeLessThanOrEqual(255);
    }
  });
});
