import type { NormalizedParams } from '@/types/weather';
import type { VisualProfile, RGB } from '@/types/mood';

/**
 * Color represented as [r, g, b, a] with each channel 0-255, alpha 0-1
 */
export type RGBA = [number, number, number, number];

/**
 * A color palette for a weather mode
 */
export interface WeatherPalette {
  background: RGBA[];
  particles: RGBA[];
}

// ── Weather mode palettes ────────────────────────────────

const RAIN_PALETTE: WeatherPalette = {
  background: [
    [26, 42, 58, 1],    // #1a2a3a
    [44, 62, 80, 1],    // #2C3E50
  ],
  particles: [
    [74, 111, 165, 0.8],  // #4A6FA5
    [107, 143, 194, 0.7], // #6B8FC2
    [138, 174, 212, 0.6], // #8AAED4
    [61, 90, 128, 0.9],   // #3d5a80
  ],
};

const SNOW_PALETTE: WeatherPalette = {
  background: [
    [20, 25, 40, 1],    // deep navy
    [40, 50, 65, 1],    // dark grey
  ],
  particles: [
    [232, 239, 245, 0.9], // #E8EFF5
    [200, 214, 229, 0.8], // #C8D6E5
    [240, 244, 248, 0.7], // #F0F4F8
    [255, 255, 255, 0.9], // #FFFFFF
  ],
};

const CLEAR_PALETTE: WeatherPalette = {
  background: [
    [255, 143, 0, 1],   // #FF8F00
    [249, 168, 37, 1],  // #F9A825
  ],
  particles: [
    [249, 168, 37, 0.8],  // #F9A825
    [255, 143, 0, 0.7],   // #FF8F00
    [255, 183, 77, 0.6],  // #FFB74D
    [255, 243, 224, 0.5], // #FFF3E0
  ],
};

const CLOUDY_PALETTE: WeatherPalette = {
  background: [
    [60, 60, 65, 1],    // dark grey
    [80, 80, 85, 1],    // medium grey
  ],
  particles: [
    [158, 158, 158, 0.4], // #9E9E9E
    [117, 117, 117, 0.3], // #757575
    [189, 189, 189, 0.35],// #BDBDBD
    [224, 224, 224, 0.3], // #E0E0E0
  ],
};

const STORM_PALETTE: WeatherPalette = {
  background: [
    [26, 0, 51, 1],     // #1A0033
    [10, 5, 20, 1],     // near-black
  ],
  particles: [
    [74, 0, 224, 0.8],    // #4A00E0
    [123, 31, 162, 0.7],  // #7B1FA2
    [0, 229, 255, 0.9],   // #00E5FF
    [26, 0, 51, 0.6],     // #1A0033
  ],
};

const WIND_PALETTE: WeatherPalette = {
  background: [
    [40, 50, 60, 1],
    [60, 70, 80, 1],
  ],
  particles: [
    [180, 200, 220, 0.7],
    [150, 170, 190, 0.6],
    [200, 215, 230, 0.8],
    [170, 190, 210, 0.5],
  ],
};

// ── Palette lookup ───────────────────────────────────────

const PALETTES: Record<string, WeatherPalette> = {
  rain: RAIN_PALETTE,
  snow: SNOW_PALETTE,
  clear: CLEAR_PALETTE,
  cloudy: CLOUDY_PALETTE,
  storm: STORM_PALETTE,
  wind: WIND_PALETTE,
};

export function getPalette(condition: string): WeatherPalette {
  return PALETTES[condition] ?? CLEAR_PALETTE;
}

// ── Profile conversion ───────────────────────────────────

/**
 * Convert an AI-generated VisualProfile to the existing ColorPalette format.
 * Maps profile colors (RGB) to RGBA with default alphas.
 */
export function profileToPalette(visual: VisualProfile): WeatherPalette {
  const rgbToRGBA = (rgb: RGB, alpha: number): RGBA =>
    [rgb[0], rgb[1], rgb[2], alpha];

  return {
    background: [
      rgbToRGBA(visual.background.topColor, 1),
      rgbToRGBA(visual.background.bottomColor, 1),
    ],
    particles: visual.particles.colors.map((c, i) =>
      rgbToRGBA(c, visual.particles.alphaRange[0] + (visual.particles.alphaRange[1] - visual.particles.alphaRange[0]) * (i / 3))
    ),
  };
}

// ── Color interpolation ──────────────────────────────────

/**
 * Linearly interpolate between two RGBA colors.
 * t is clamped to [0, 1].
 */
export function lerpColor(a: RGBA, b: RGBA, t: number): RGBA {
  const ct = Math.max(0, Math.min(1, t));
  return [
    Math.round(a[0] + (b[0] - a[0]) * ct),
    Math.round(a[1] + (b[1] - a[1]) * ct),
    Math.round(a[2] + (b[2] - a[2]) * ct),
    a[3] + (b[3] - a[3]) * ct,
  ];
}

/**
 * Convert RGBA to a CSS color string.
 */
export function rgbaToString(color: RGBA): string {
  return `rgba(${color[0]},${color[1]},${color[2]},${color[3]})`;
}

/**
 * Pick a random particle color from a palette.
 */
export function randomParticleColor(palette: WeatherPalette): RGBA {
  const colors = palette.particles;
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Apply temperature-driven warmth shift to a palette's particle colors.
 * At temperature 0 (cold), colors shift toward blue.
 * At temperature 1 (hot), colors shift toward amber.
 */
export function temperatureShift(color: RGBA, temperature: number): RGBA {
  const cold: RGBA = [100, 140, 200, color[3]];
  const warm: RGBA = [255, 180, 80, color[3]];
  const tint = temperature < 0.5
    ? lerpColor(cold, [color[0], color[1], color[2], color[3]], temperature * 2)
    : lerpColor([color[0], color[1], color[2], color[3]], warm, (temperature - 0.5) * 2);

  // Blend the tint with the original color at 30% strength
  return lerpColor(color, tint, 0.3);
}

/**
 * Build a background gradient string for the canvas from normalized params.
 */
export function buildBackgroundGradient(
  palette: WeatherPalette,
  params: NormalizedParams,
): { top: string; bottom: string } {
  const bg = palette.background;
  const top = temperatureShift(bg[0], params.temperature);
  const bottom = temperatureShift(bg[1] ?? bg[0], params.temperature);
  return {
    top: rgbaToString(top),
    bottom: rgbaToString(bottom),
  };
}
