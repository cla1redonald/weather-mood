import { describe, it, expect } from 'vitest';
import { temperatureToFrequency } from '@/lib/audio/tone';
import { windToLfoRate, windToLfoDepth } from '@/lib/audio/wind';
import { humidityToCutoff } from '@/lib/audio/humidity';
import { getPrecipConfig } from '@/lib/audio/precipitation';
import type { WeatherCondition } from '@/types/weather';

describe('temperatureToFrequency', () => {
  it('maps 0.0 (cold) to 80Hz', () => {
    expect(temperatureToFrequency(0)).toBe(80);
  });

  it('maps 1.0 (hot) to 300Hz', () => {
    expect(temperatureToFrequency(1)).toBe(300);
  });

  it('maps 0.5 (mild) to 190Hz', () => {
    expect(temperatureToFrequency(0.5)).toBe(190);
  });

  it('clamps values below 0', () => {
    expect(temperatureToFrequency(-0.5)).toBe(80);
  });

  it('clamps values above 1', () => {
    expect(temperatureToFrequency(1.5)).toBe(300);
  });

  it('interpolates linearly', () => {
    const freq25 = temperatureToFrequency(0.25);
    const freq75 = temperatureToFrequency(0.75);
    expect(freq25).toBe(80 + 0.25 * 220);
    expect(freq75).toBe(80 + 0.75 * 220);
  });
});

describe('windToLfoRate', () => {
  it('maps 0.0 (calm) to 0.5Hz', () => {
    expect(windToLfoRate(0)).toBe(0.5);
  });

  it('maps 1.0 (gale) to 4Hz', () => {
    expect(windToLfoRate(1)).toBe(4);
  });

  it('maps 0.5 to midpoint', () => {
    expect(windToLfoRate(0.5)).toBe(2.25);
  });

  it('clamps values below 0', () => {
    expect(windToLfoRate(-1)).toBe(0.5);
  });

  it('clamps values above 1', () => {
    expect(windToLfoRate(2)).toBe(4);
  });
});

describe('windToLfoDepth', () => {
  it('maps 0.0 (calm) to 0.05', () => {
    expect(windToLfoDepth(0)).toBe(0.05);
  });

  it('maps 1.0 (gale) to 0.4', () => {
    expect(windToLfoDepth(1)).toBeCloseTo(0.4);
  });

  it('clamps values below 0', () => {
    expect(windToLfoDepth(-1)).toBe(0.05);
  });

  it('clamps values above 1', () => {
    expect(windToLfoDepth(2)).toBeCloseTo(0.4);
  });
});

describe('humidityToCutoff', () => {
  it('maps 0.0 (dry) to 4000Hz', () => {
    expect(humidityToCutoff(0)).toBe(4000);
  });

  it('maps 1.0 (humid) to 800Hz', () => {
    expect(humidityToCutoff(1)).toBe(800);
  });

  it('maps 0.5 to midpoint (2400Hz)', () => {
    expect(humidityToCutoff(0.5)).toBe(2400);
  });

  it('clamps values below 0', () => {
    expect(humidityToCutoff(-1)).toBe(4000);
  });

  it('clamps values above 1', () => {
    expect(humidityToCutoff(2)).toBe(800);
  });

  it('is inversely proportional to humidity', () => {
    const dry = humidityToCutoff(0.2);
    const humid = humidityToCutoff(0.8);
    expect(dry).toBeGreaterThan(humid);
  });
});

describe('getPrecipConfig', () => {
  it('returns rain config for rain', () => {
    const config = getPrecipConfig('rain');
    expect(config).not.toBeNull();
    expect(config!.frequency).toBe(2000);
    expect(config!.gain).toBe(0.1);
  });

  it('returns rain config for storm', () => {
    const config = getPrecipConfig('storm');
    expect(config).not.toBeNull();
    expect(config!.frequency).toBe(2000);
    expect(config!.gain).toBe(0.1);
  });

  it('returns snow config for snow', () => {
    const config = getPrecipConfig('snow');
    expect(config).not.toBeNull();
    expect(config!.frequency).toBe(4000);
    expect(config!.gain).toBe(0.03);
  });

  it('returns null for clear', () => {
    expect(getPrecipConfig('clear')).toBeNull();
  });

  it('returns null for cloudy', () => {
    expect(getPrecipConfig('cloudy')).toBeNull();
  });

  it('returns null for wind', () => {
    expect(getPrecipConfig('wind')).toBeNull();
  });

  it('snow is quieter than rain', () => {
    const rain = getPrecipConfig('rain')!;
    const snow = getPrecipConfig('snow')!;
    expect(snow.gain).toBeLessThan(rain.gain);
  });

  it('handles all WeatherCondition values', () => {
    const conditions: WeatherCondition[] = [
      'rain',
      'snow',
      'clear',
      'cloudy',
      'storm',
      'wind',
    ];
    for (const condition of conditions) {
      // Should not throw for any valid condition
      getPrecipConfig(condition);
    }
  });
});
