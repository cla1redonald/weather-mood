/**
 * AI-generated mood profile — unique per city/weather combination.
 * Claude generates these parameters alongside the poem.
 */

export interface SoundscapeProfile {
  tone: {
    frequency: number;       // 40-400 Hz
    waveform: OscillatorType; // 'sine' | 'triangle' | 'sawtooth' | 'square'
    gain: number;            // 0-0.3
    harmonics: {
      second: number;        // 0-0.4 (gain of 2nd overtone)
      third: number;         // 0-0.3 (gain of 3rd overtone)
      waveform: OscillatorType;
    };
  };
  wind: {
    lfoRate: number;         // 0.1-6 Hz
    lfoDepth: number;        // 0-0.5
    lfoWaveform: 'sine' | 'triangle';
    gustIntensity: number;   // 0-1 (simplex noise modulation depth)
  };
  filter: {
    cutoff: number;          // 200-6000 Hz
    Q: number;               // 0.5-4
    highShelfGain: number;   // -12 to 0 dB
  };
  precipitation: {
    active: boolean;
    noiseColor: 'white' | 'pink' | 'brown';
    centerFrequency: number; // 500-6000 Hz
    Q: number;               // 0.2-2
    gain: number;            // 0-0.25
  };
  thunder: {
    active: boolean;
    intensity: number;       // 0-1
    intervalMin: number;     // 3-10 seconds
    intervalMax: number;     // 8-20 seconds
  };
  master: {
    gain: number;            // 0.5-1.0
  };
  description: string;
}

export type RGB = [number, number, number];

export interface VisualProfile {
  background: {
    topColor: RGB;
    bottomColor: RGB;
    style: 'linear' | 'radial';
  };
  particles: {
    colors: [RGB, RGB, RGB, RGB];
    maxCount: number;        // 50-400
    spawnRate: number;       // 5-40 per second
    sizeRange: [number, number];   // [min, max] px
    alphaRange: [number, number];  // [min, max] 0-1
    speedRange: [number, number];  // [min, max] px/sec
    direction: 'down' | 'up' | 'left' | 'right' | 'random';
    lifespan: [number, number];    // [min, max] seconds
    drawStyle: 'circle' | 'line' | 'glow' | 'trail';
  };
  effects: {
    ripples: { active: boolean; color: RGB; rate: number };
    lightning: { active: boolean; interval: [number, number] };
    cloudNoise: { active: boolean; opacity: number; scale: number };
    glow: { active: boolean; color: RGB; intensity: number };
  };
  description: string;
}

export interface MoodResponse {
  poem: string;
  sound: SoundscapeProfile;
  visual: VisualProfile;
  cached: boolean;
}

/** Clamp a number to [min, max] */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Clamp an RGB array to valid ranges */
function clampRGB(rgb: unknown): RGB {
  if (!Array.isArray(rgb) || rgb.length < 3) return [128, 128, 128];
  return [
    clamp(Math.round(rgb[0] ?? 128), 0, 255),
    clamp(Math.round(rgb[1] ?? 128), 0, 255),
    clamp(Math.round(rgb[2] ?? 128), 0, 255),
  ];
}

/** Validate and clamp a SoundscapeProfile from AI output */
export function clampSoundProfile(raw: Partial<SoundscapeProfile>): SoundscapeProfile {
  const tone = raw.tone ?? {} as Partial<SoundscapeProfile['tone']>;
  const harmonics = tone.harmonics ?? {} as Partial<SoundscapeProfile['tone']['harmonics']>;
  const wind = raw.wind ?? {} as Partial<SoundscapeProfile['wind']>;
  const filter = raw.filter ?? {} as Partial<SoundscapeProfile['filter']>;
  const precip = raw.precipitation ?? {} as Partial<SoundscapeProfile['precipitation']>;
  const thunder = raw.thunder ?? {} as Partial<SoundscapeProfile['thunder']>;
  const master = raw.master ?? {} as Partial<SoundscapeProfile['master']>;

  return {
    tone: {
      frequency: clamp(tone.frequency ?? 150, 40, 400),
      waveform: validateWaveform(tone.waveform, 'sine'),
      gain: clamp(tone.gain ?? 0.15, 0, 0.3),
      harmonics: {
        second: clamp(harmonics.second ?? 0.1, 0, 0.4),
        third: clamp(harmonics.third ?? 0.05, 0, 0.3),
        waveform: validateWaveform(harmonics.waveform, 'sine'),
      },
    },
    wind: {
      lfoRate: clamp(wind.lfoRate ?? 1, 0.1, 6),
      lfoDepth: clamp(wind.lfoDepth ?? 0.1, 0, 0.5),
      lfoWaveform: wind.lfoWaveform === 'triangle' ? 'triangle' : 'sine',
      gustIntensity: clamp(wind.gustIntensity ?? 0.3, 0, 1),
    },
    filter: {
      cutoff: clamp(filter.cutoff ?? 3000, 200, 6000),
      Q: clamp(filter.Q ?? 1, 0.5, 4),
      highShelfGain: clamp(filter.highShelfGain ?? 0, -12, 0),
    },
    precipitation: {
      active: precip.active ?? false,
      noiseColor: validateNoiseColor(precip.noiseColor),
      centerFrequency: clamp(precip.centerFrequency ?? 2000, 500, 6000),
      Q: clamp(precip.Q ?? 0.5, 0.2, 2),
      gain: clamp(precip.gain ?? 0.1, 0, 0.25),
    },
    thunder: {
      active: thunder.active ?? false,
      intensity: clamp(thunder.intensity ?? 0.5, 0, 1),
      intervalMin: clamp(thunder.intervalMin ?? 5, 3, 10),
      intervalMax: clamp(thunder.intervalMax ?? 15, 8, 20),
    },
    master: {
      gain: clamp(master.gain ?? 0.8, 0.5, 1),
    },
    description: raw.description ?? '',
  };
}

/** Validate and clamp a VisualProfile from AI output */
export function clampVisualProfile(raw: Partial<VisualProfile>): VisualProfile {
  const bg = raw.background ?? {} as Partial<VisualProfile['background']>;
  const p = raw.particles ?? {} as Partial<VisualProfile['particles']>;
  const fx = raw.effects ?? {} as Partial<VisualProfile['effects']>;
  const ripples = fx.ripples ?? {} as Partial<VisualProfile['effects']['ripples']>;
  const lightning = fx.lightning ?? {} as Partial<VisualProfile['effects']['lightning']>;
  const cloudNoise = fx.cloudNoise ?? {} as Partial<VisualProfile['effects']['cloudNoise']>;
  const glow = fx.glow ?? {} as Partial<VisualProfile['effects']['glow']>;

  const colors = Array.isArray(p.colors) && p.colors.length >= 4
    ? [clampRGB(p.colors[0]), clampRGB(p.colors[1]), clampRGB(p.colors[2]), clampRGB(p.colors[3])] as [RGB, RGB, RGB, RGB]
    : [[180, 180, 200], [150, 150, 170], [200, 200, 220], [160, 160, 180]] as [RGB, RGB, RGB, RGB];

  return {
    background: {
      topColor: clampRGB(bg.topColor),
      bottomColor: clampRGB(bg.bottomColor),
      style: bg.style === 'radial' ? 'radial' : 'linear',
    },
    particles: {
      colors,
      maxCount: clamp(p.maxCount ?? 200, 50, 400),
      spawnRate: clamp(p.spawnRate ?? 15, 5, 40),
      sizeRange: clampRange(p.sizeRange, 1, 24, 2, 6),
      alphaRange: clampRange(p.alphaRange, 0, 1, 0.3, 0.8),
      speedRange: clampRange(p.speedRange, 0.1, 15, 1, 4),
      direction: validateDirection(p.direction),
      lifespan: clampRange(p.lifespan, 1, 20, 3, 8),
      drawStyle: validateDrawStyle(p.drawStyle),
    },
    effects: {
      ripples: {
        active: ripples.active ?? false,
        color: clampRGB(ripples.color),
        rate: clamp(ripples.rate ?? 5, 1, 20),
      },
      lightning: {
        active: lightning.active ?? false,
        interval: clampRange(lightning.interval, 2, 30, 5, 15),
      },
      cloudNoise: {
        active: cloudNoise.active ?? false,
        opacity: clamp(cloudNoise.opacity ?? 0.08, 0.02, 0.2),
        scale: clamp(cloudNoise.scale ?? 0.003, 0.001, 0.01),
      },
      glow: {
        active: glow.active ?? false,
        color: clampRGB(glow.color),
        intensity: clamp(glow.intensity ?? 0.3, 0, 1),
      },
    },
    description: raw.description ?? '',
  };
}

function validateWaveform(value: unknown, fallback: OscillatorType): OscillatorType {
  const valid: OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'square'];
  return valid.includes(value as OscillatorType) ? (value as OscillatorType) : fallback;
}

function validateNoiseColor(value: unknown): 'white' | 'pink' | 'brown' {
  const valid = ['white', 'pink', 'brown'];
  return valid.includes(value as string) ? (value as 'white' | 'pink' | 'brown') : 'pink';
}

function validateDirection(value: unknown): VisualProfile['particles']['direction'] {
  const valid = ['down', 'up', 'left', 'right', 'random'];
  return valid.includes(value as string) ? (value as VisualProfile['particles']['direction']) : 'down';
}

function validateDrawStyle(value: unknown): VisualProfile['particles']['drawStyle'] {
  const valid = ['circle', 'line', 'glow', 'trail'];
  return valid.includes(value as string) ? (value as VisualProfile['particles']['drawStyle']) : 'circle';
}

function clampRange(
  value: unknown,
  absMin: number,
  absMax: number,
  defaultMin: number,
  defaultMax: number,
): [number, number] {
  if (!Array.isArray(value) || value.length < 2) return [defaultMin, defaultMax];
  const min = clamp(value[0] ?? defaultMin, absMin, absMax);
  const max = clamp(value[1] ?? defaultMax, absMin, absMax);
  return min <= max ? [min, max] : [max, min];
}
