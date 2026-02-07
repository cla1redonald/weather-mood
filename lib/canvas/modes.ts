import { createNoise2D } from 'simplex-noise';
import type { WeatherCondition, NormalizedParams } from '@/types/weather';
import type { VisualProfile } from '@/types/mood';
import {
  type WeatherPalette,
  buildBackgroundGradient,
  rgbaToString,
  lerpColor,
  profileToPalette,
  type RGBA,
} from './palette';

// ── Shared simplex noise instance ────────────────────────

let noise2D: ReturnType<typeof createNoise2D> | null = null;
function getNoise(): ReturnType<typeof createNoise2D> {
  if (!noise2D) {
    noise2D = createNoise2D();
  }
  return noise2D;
}

// ── Offscreen canvas for smooth noise rendering ──────────

let noiseCanvas: HTMLCanvasElement | null = null;
let noiseCtx: CanvasRenderingContext2D | null = null;
let noiseImageData: ImageData | null = null;
let lastNoiseW = 0;
let lastNoiseH = 0;

const NOISE_SCALE_FACTOR = 2; // render at 1/2 resolution (was 4 — too pixelated)

function drawSmoothNoise(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  noiseScale: number,
  timeOffset: number,
  opacity: number,
): void {
  const nw = Math.ceil(w / NOISE_SCALE_FACTOR);
  const nh = Math.ceil(h / NOISE_SCALE_FACTOR);

  // Create or resize offscreen canvas
  if (!noiseCanvas || !noiseCtx || lastNoiseW !== nw || lastNoiseH !== nh) {
    noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = nw;
    noiseCanvas.height = nh;
    noiseCtx = noiseCanvas.getContext('2d')!;
    noiseImageData = noiseCtx.createImageData(nw, nh);
    lastNoiseW = nw;
    lastNoiseH = nh;
  }

  const noise = getNoise();
  const data = noiseImageData!.data;

  // Write noise values directly to ImageData pixels
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const worldX = x * NOISE_SCALE_FACTOR;
      const worldY = y * NOISE_SCALE_FACTOR;
      const n = noise(worldX * noiseScale + timeOffset, worldY * noiseScale);
      const brightness = Math.floor(128 + n * 80);
      const idx = (y * nw + x) * 4;
      data[idx] = brightness;
      data[idx + 1] = brightness;
      data[idx + 2] = brightness;
      data[idx + 3] = 255;
    }
  }

  noiseCtx!.putImageData(noiseImageData!, 0, 0);

  // Draw scaled up with bilinear interpolation
  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.globalAlpha = opacity;
  ctx.drawImage(noiseCanvas!, 0, 0, nw, nh, 0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = prevSmoothing;
}

// ── Mode state (persists across frames) ──────────────────

interface ModeState {
  /** Time accumulator for animations */
  time: number;
  /** Last lightning flash time (storm mode) */
  lastFlash: number;
  /** Next flash interval (storm mode) */
  nextFlashInterval: number;
  /** Current flash intensity (storm mode) */
  flashIntensity: number;
  /** Ripple positions (rain mode) */
  ripples: Array<{ x: number; y: number; radius: number; alpha: number }>;
}

let state: ModeState = {
  time: 0,
  lastFlash: 0,
  nextFlashInterval: 5 + Math.random() * 10,
  flashIntensity: 0,
  ripples: [],
};

/**
 * Reset the mode state (call when switching conditions).
 */
export function resetModeState(): void {
  state = {
    time: 0,
    lastFlash: 0,
    nextFlashInterval: 5 + Math.random() * 10,
    flashIntensity: 0,
    ripples: [],
  };
  noise2D = null;
  noiseCanvas = null;
  noiseCtx = null;
  noiseImageData = null;
  lastNoiseW = 0;
  lastNoiseH = 0;
}

// ── Background renderers ─────────────────────────────────

/**
 * Draw the background for the current weather mode.
 */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  condition: WeatherCondition,
  params: NormalizedParams,
  palette: WeatherPalette,
  dt: number,
): void {
  state.time += dt;

  switch (condition) {
    case 'rain':
      drawRainBackground(ctx, w, h, palette, params);
      break;
    case 'snow':
      drawSnowBackground(ctx, w, h, palette, params);
      break;
    case 'clear':
      drawClearBackground(ctx, w, h, palette, params);
      break;
    case 'cloudy':
      drawCloudyBackground(ctx, w, h, palette, params);
      break;
    case 'storm':
      drawStormBackground(ctx, w, h, palette, params, dt);
      break;
    case 'wind':
      drawWindBackground(ctx, w, h, palette, params);
      break;
  }
}

/**
 * Draw mode-specific foreground effects (ripples, flashes, etc.).
 * Call AFTER particles are drawn.
 */
export function drawForeground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  condition: WeatherCondition,
  params: NormalizedParams,
  dt: number,
): void {
  switch (condition) {
    case 'rain':
      updateRipples(ctx, w, h, params, dt);
      break;
    case 'storm':
      drawLightningFlash(ctx, w, h, dt);
      break;
  }
}

// ── Profile-driven mode ──────────────────────────────────

/**
 * Configuration generated from a VisualProfile that controls
 * background rendering, particle spawning, and foreground effects.
 */
export interface ProfileModeConfig {
  backgroundStyle: 'linear' | 'radial';
  palette: WeatherPalette;
  spawnRate: number;
  sizeRange: [number, number];
  alphaRange: [number, number];
  speedRange: [number, number];
  direction: 'down' | 'up' | 'left' | 'right' | 'random';
  lifespan: [number, number];
  maxCount: number;
  drawStyle: 'circle' | 'line' | 'glow' | 'trail';
  effects: {
    ripples: { active: boolean; color: RGBA; rate: number };
    lightning: { active: boolean; interval: [number, number] };
    cloudNoise: { active: boolean; opacity: number; scale: number };
    glow: { active: boolean; color: RGBA; intensity: number };
  };
}

/**
 * Create a mode config from an AI-generated VisualProfile.
 * This bypasses condition-based mode selection entirely.
 */
export function createProfileMode(visual: VisualProfile): ProfileModeConfig {
  const palette = profileToPalette(visual);
  const rgbToRGBA = (rgb: [number, number, number], alpha: number): RGBA =>
    [rgb[0], rgb[1], rgb[2], alpha];

  return {
    backgroundStyle: visual.background.style,
    palette,
    spawnRate: visual.particles.spawnRate,
    sizeRange: visual.particles.sizeRange,
    alphaRange: visual.particles.alphaRange,
    speedRange: visual.particles.speedRange,
    direction: visual.particles.direction,
    lifespan: visual.particles.lifespan,
    maxCount: visual.particles.maxCount,
    drawStyle: visual.particles.drawStyle,
    effects: {
      ripples: {
        active: visual.effects.ripples.active,
        color: rgbToRGBA(visual.effects.ripples.color, 0.4),
        rate: visual.effects.ripples.rate,
      },
      lightning: {
        active: visual.effects.lightning.active,
        interval: visual.effects.lightning.interval,
      },
      cloudNoise: {
        active: visual.effects.cloudNoise.active,
        opacity: visual.effects.cloudNoise.opacity,
        scale: visual.effects.cloudNoise.scale,
      },
      glow: {
        active: visual.effects.glow.active,
        color: rgbToRGBA(visual.effects.glow.color, visual.effects.glow.intensity),
        intensity: visual.effects.glow.intensity,
      },
    },
  };
}

/**
 * Draw background using a profile mode config instead of condition-based logic.
 */
export function drawProfileBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  config: ProfileModeConfig,
  params: NormalizedParams,
  dt: number,
): void {
  state.time += dt;
  const bg = config.palette.background;
  const topColor = rgbaToString(bg[0]);
  const bottomColor = rgbaToString(bg[1] ?? bg[0]);

  if (config.backgroundStyle === 'radial') {
    const cx = w / 2;
    const cy = h * 0.4;
    const maxRadius = Math.max(w, h) * 0.8;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, bottomColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, topColor);
    gradient.addColorStop(1, bottomColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  // Cloud noise overlay if active
  if (config.effects.cloudNoise.active) {
    drawSmoothNoise(
      ctx, w, h,
      config.effects.cloudNoise.scale,
      state.time * 0.02,
      config.effects.cloudNoise.opacity,
    );
  }

  // Glow effect if active
  if (config.effects.glow.active) {
    const gc = config.effects.glow.color;
    const intensity = config.effects.glow.intensity;
    const glowGradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
    glowGradient.addColorStop(0, `rgba(${gc[0]},${gc[1]},${gc[2]},${intensity * 0.3})`);
    glowGradient.addColorStop(1, `rgba(${gc[0]},${gc[1]},${gc[2]},0)`);
    ctx.fillStyle = glowGradient;
    ctx.fillRect(0, 0, w, h);
  }
}

/**
 * Draw foreground effects using a profile mode config.
 */
export function drawProfileForeground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  config: ProfileModeConfig,
  dt: number,
): void {
  // Ripples
  if (config.effects.ripples.active) {
    // Cap ripple count before spawning
    if (state.ripples.length < 50) {
      const spawnRate = config.effects.ripples.rate;
      if (Math.random() < spawnRate * dt) {
        state.ripples.push({
          x: Math.random() * w,
          y: h - 10 + Math.random() * 10,
          radius: 1,
          alpha: 0.4,
        });
      }
    }

    const rc = config.effects.ripples.color;
    for (let i = state.ripples.length - 1; i >= 0; i--) {
      const r = state.ripples[i];
      r.radius += dt * 30;
      r.alpha -= dt * 0.8;
      if (r.alpha <= 0) {
        state.ripples.splice(i, 1);
        continue;
      }
      ctx.strokeStyle = `rgba(${rc[0]},${rc[1]},${rc[2]},${r.alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (state.ripples.length > 50) {
      state.ripples.splice(0, state.ripples.length - 50);
    }
  }

  // Lightning
  if (config.effects.lightning.active) {
    const [minInterval, maxInterval] = config.effects.lightning.interval;
    state.lastFlash += dt;
    if (state.lastFlash >= state.nextFlashInterval) {
      state.flashIntensity = 0.8;
      state.lastFlash = 0;
      state.nextFlashInterval = minInterval + Math.random() * (maxInterval - minInterval);
    }
    if (state.flashIntensity > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${state.flashIntensity})`;
      ctx.fillRect(0, 0, w, h);
      state.flashIntensity *= 0.85;
    }
  }
}

// ── Rain ─────────────────────────────────────────────────

function drawRainBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: WeatherPalette,
  params: NormalizedParams,
): void {
  const { top, bottom } = buildBackgroundGradient(palette, params);
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function updateRipples(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  params: NormalizedParams,
  dt: number,
): void {
  // Cap ripple count before spawning
  if (state.ripples.length >= 50) return;

  // Spawn new ripples at the bottom
  const spawnRate = 5 + params.humidity * 10;
  if (Math.random() < spawnRate * dt) {
    state.ripples.push({
      x: Math.random() * w,
      y: h - 10 + Math.random() * 10,
      radius: 1,
      alpha: 0.4,
    });
  }

  // Update and draw ripples
  for (let i = state.ripples.length - 1; i >= 0; i--) {
    const r = state.ripples[i];
    r.radius += dt * 30;
    r.alpha -= dt * 0.8;

    if (r.alpha <= 0) {
      state.ripples.splice(i, 1);
      continue;
    }

    ctx.strokeStyle = `rgba(150,180,220,${r.alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Cap ripple count
  if (state.ripples.length > 50) {
    state.ripples.splice(0, state.ripples.length - 50);
  }
}

// ── Snow ─────────────────────────────────────────────────

function drawSnowBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: WeatherPalette,
  params: NormalizedParams,
): void {
  const { top, bottom } = buildBackgroundGradient(palette, params);
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

// ── Clear / Sunny ────────────────────────────────────────

function drawClearBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: WeatherPalette,
  params: NormalizedParams,
): void {
  // Warm radial gradient from center
  const cx = w / 2;
  const cy = h * 0.4;
  const maxRadius = Math.max(w, h) * 0.8;

  const bg = palette.background;
  const centerColor = lerpColor(bg[0], [255, 215, 0, 1] as RGBA, params.temperature * 0.3);
  const edgeColor = bg[1] ?? bg[0];

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
  gradient.addColorStop(0, rgbaToString(centerColor));
  gradient.addColorStop(1, rgbaToString(edgeColor));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

// ── Cloudy ───────────────────────────────────────────────

function drawCloudyBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: WeatherPalette,
  params: NormalizedParams,
): void {
  // Base gradient
  const { top, bottom } = buildBackgroundGradient(palette, params);
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // Simplex noise overlay for cloud texture
  const opacity = 0.06 + params.cloudCover * 0.08;
  drawSmoothNoise(ctx, w, h, 0.003, state.time * 0.02, opacity);
}

// ── Storm ────────────────────────────────────────────────

function drawStormBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: WeatherPalette,
  params: NormalizedParams,
  dt: number,
): void {
  const { top, bottom } = buildBackgroundGradient(palette, params);
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  // Electric blue edge glow
  const edgeGradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  edgeGradient.addColorStop(0, 'rgba(0,0,0,0)');
  edgeGradient.addColorStop(0.7, 'rgba(0,0,0,0)');
  edgeGradient.addColorStop(1, 'rgba(0,100,200,0.1)');
  ctx.fillStyle = edgeGradient;
  ctx.fillRect(0, 0, w, h);
}

function drawLightningFlash(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dt: number,
): void {
  state.lastFlash += dt;

  // Trigger flash
  if (state.lastFlash >= state.nextFlashInterval) {
    state.flashIntensity = 0.8;
    state.lastFlash = 0;
    state.nextFlashInterval = 5 + Math.random() * 10;
  }

  // Draw flash
  if (state.flashIntensity > 0.01) {
    ctx.fillStyle = `rgba(255,255,255,${state.flashIntensity})`;
    ctx.fillRect(0, 0, w, h);
    state.flashIntensity *= 0.85; // Quick fade
  }
}

// ── Wind ─────────────────────────────────────────────────

function drawWindBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: WeatherPalette,
  params: NormalizedParams,
): void {
  const { top, bottom } = buildBackgroundGradient(palette, params);
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}
