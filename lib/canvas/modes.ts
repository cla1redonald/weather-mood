import { createNoise2D } from 'simplex-noise';
import type { WeatherCondition, NormalizedParams } from '@/types/weather';
import {
  type WeatherPalette,
  buildBackgroundGradient,
  rgbaToString,
  lerpColor,
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
  const noise = getNoise();
  const scale = 0.003;
  const timeScale = state.time * 0.02;
  const opacity = 0.06 + params.cloudCover * 0.08;

  // Sample at lower resolution for performance
  const step = 16;
  for (let x = 0; x < w; x += step) {
    for (let y = 0; y < h; y += step) {
      const n = noise(x * scale + timeScale, y * scale);
      const brightness = Math.floor(128 + n * 80);
      ctx.fillStyle = `rgba(${brightness},${brightness},${brightness},${opacity})`;
      ctx.fillRect(x, y, step, step);
    }
  }
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
