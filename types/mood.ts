/**
 * AI-generated mood profile — unique per city/weather combination.
 * Claude generates these parameters alongside the poem.
 */

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
  visual: VisualProfile;
  voice: string;
  fontFamily: string;
  musicDirection: string;
  ambienceDirection: string;
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
