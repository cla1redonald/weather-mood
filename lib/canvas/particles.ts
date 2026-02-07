import type { WeatherCondition, NormalizedParams } from '@/types/weather';
import type { ProfileModeConfig } from './modes';
import {
  type RGBA,
  type WeatherPalette,
  randomParticleColor,
  temperatureShift,
  rgbaToString,
} from './palette';

// ── Particle structure ───────────────────────────────────

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: RGBA;
  alpha: number;
  life: number;     // 0-1, decreases over time
  maxLife: number;   // total lifetime in seconds
  /** Previous positions for trail rendering (wind mode) */
  trail: Array<{ x: number; y: number }>;
}

// ── Particle pool ────────────────────────────────────────

export interface ParticlePool {
  particles: Particle[];
  maxCount: number;
}

/**
 * Determine max particle count based on device width and weather mode.
 */
export function getMaxParticles(
  viewportWidth: number,
  condition: WeatherCondition,
): number {
  const isMobile = viewportWidth < 768;

  const counts: Record<WeatherCondition, { desktop: number; mobile: number }> = {
    rain:  { desktop: 300, mobile: 150 },
    snow:  { desktop: 200, mobile: 100 },
    clear: { desktop: 250, mobile: 120 },
    cloudy:{ desktop: 100, mobile: 50 },
    storm: { desktop: 400, mobile: 200 },
    wind:  { desktop: 300, mobile: 150 },
  };

  const entry = counts[condition];
  return isMobile ? entry.mobile : entry.desktop;
}

/**
 * Create an empty particle pool.
 */
export function createPool(maxCount: number): ParticlePool {
  return { particles: [], maxCount };
}

// ── Spawning ─────────────────────────────────────────────

interface SpawnConfig {
  canvasWidth: number;
  canvasHeight: number;
  condition: WeatherCondition;
  params: NormalizedParams;
  palette: WeatherPalette;
}

/**
 * Spawn a single particle configured for the given weather mode.
 */
export function spawnParticle(config: SpawnConfig): Particle {
  const { canvasWidth, canvasHeight, condition, params, palette } = config;
  const baseColor = randomParticleColor(palette);
  const color = temperatureShift(baseColor, params.temperature);

  switch (condition) {
    case 'rain':
      return createRainParticle(canvasWidth, canvasHeight, params, color);
    case 'snow':
      return createSnowParticle(canvasWidth, canvasHeight, color);
    case 'clear':
      return createClearParticle(canvasWidth, canvasHeight, color);
    case 'cloudy':
      return createCloudyParticle(canvasWidth, canvasHeight, color);
    case 'storm':
      return createStormParticle(canvasWidth, canvasHeight, params, color);
    case 'wind':
      return createWindParticle(canvasWidth, canvasHeight, params, color);
    default:
      return createClearParticle(canvasWidth, canvasHeight, color);
  }
}

function createRainParticle(
  w: number, h: number, params: NormalizedParams, color: RGBA,
): Particle {
  const speed = 4 + params.windSpeed * 6;
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.3;
  return {
    x: Math.random() * w * 1.2 - w * 0.1,
    y: -Math.random() * h * 0.3,
    vx: Math.cos(angle) * speed * 0.5 + params.windSpeed * 2,
    vy: Math.sin(angle) * -speed,
    size: 1 + Math.random() * 2,
    color,
    alpha: 0.5 + Math.random() * 0.5,
    life: 1,
    maxLife: 2 + Math.random() * 2,
    trail: [],
  };
}

function createSnowParticle(w: number, h: number, color: RGBA): Particle {
  return {
    x: Math.random() * w,
    y: -Math.random() * h * 0.2,
    vx: (Math.random() - 0.5) * 0.5,
    vy: 0.5 + Math.random() * 1,
    size: 2 + Math.random() * 4,
    color,
    alpha: 0.4 + Math.random() * 0.5,
    life: 1,
    maxLife: 5 + Math.random() * 5,
    trail: [],
  };
}

function createClearParticle(w: number, h: number, color: RGBA): Particle {
  const isGlow = Math.random() < 0.1;
  return {
    x: Math.random() * w,
    y: h + Math.random() * h * 0.1,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -(0.3 + Math.random() * 1),
    size: isGlow ? 4 + Math.random() * 6 : 1.5 + Math.random() * 3,
    color,
    alpha: isGlow ? 0.3 + Math.random() * 0.3 : 0.4 + Math.random() * 0.4,
    life: 1,
    maxLife: 4 + Math.random() * 4,
    trail: [],
  };
}

function createCloudyParticle(w: number, h: number, color: RGBA): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.2,
    vy: (Math.random() - 0.5) * 0.1,
    size: 8 + Math.random() * 16,
    color,
    alpha: 0.05 + Math.random() * 0.1,
    life: 1,
    maxLife: 8 + Math.random() * 8,
    trail: [],
  };
}

function createStormParticle(
  w: number, h: number, params: NormalizedParams, color: RGBA,
): Particle {
  const isRain = Math.random() < 0.6;
  if (isRain) {
    return createRainParticle(w, h, params, color);
  }
  // Burst particle
  const cx = Math.random() * w;
  const cy = Math.random() * h;
  const angle = Math.random() * Math.PI * 2;
  const speed = 2 + Math.random() * 4;
  return {
    x: cx,
    y: cy,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 1 + Math.random() * 3,
    color,
    alpha: 0.6 + Math.random() * 0.4,
    life: 1,
    maxLife: 1 + Math.random() * 2,
    trail: [],
  };
}

function createWindParticle(
  w: number, h: number, params: NormalizedParams, color: RGBA,
): Particle {
  const speed = 3 + params.windSpeed * 8;
  // Wind blows mostly horizontal with slight vertical variance
  return {
    x: -Math.random() * w * 0.1,
    y: Math.random() * h,
    vx: speed,
    vy: (Math.random() - 0.5) * 1.5,
    size: 1 + Math.random() * 2,
    color,
    alpha: 0.4 + Math.random() * 0.4,
    life: 1,
    maxLife: 2 + Math.random() * 3,
    trail: [],
  };
}

// ── Profile-driven spawning ──────────────────────────────

export interface ProfileSpawnConfig {
  canvasWidth: number;
  canvasHeight: number;
  profileMode: ProfileModeConfig;
  params: NormalizedParams;
}

/**
 * Spawn a particle using a VisualProfile-driven mode config.
 */
export function spawnProfileParticle(config: ProfileSpawnConfig): Particle {
  const { canvasWidth, canvasHeight, profileMode, params } = config;
  const palette = profileMode.palette;
  const baseColor = randomParticleColor(palette);
  const color = temperatureShift(baseColor, params.temperature);

  const [sMin, sMax] = profileMode.sizeRange;
  const [aMin, aMax] = profileMode.alphaRange;
  const [spMin, spMax] = profileMode.speedRange;
  const [lMin, lMax] = profileMode.lifespan;

  const size = sMin + Math.random() * (sMax - sMin);
  const alpha = aMin + Math.random() * (aMax - aMin);
  const speed = spMin + Math.random() * (spMax - spMin);
  const maxLife = lMin + Math.random() * (lMax - lMin);

  // Compute velocity based on direction
  let vx = 0;
  let vy = 0;
  let x = Math.random() * canvasWidth;
  let y = Math.random() * canvasHeight;

  switch (profileMode.direction) {
    case 'down':
      vx = (Math.random() - 0.5) * speed * 0.2;
      vy = speed;
      x = Math.random() * canvasWidth;
      y = -Math.random() * canvasHeight * 0.2;
      break;
    case 'up':
      vx = (Math.random() - 0.5) * speed * 0.2;
      vy = -speed;
      x = Math.random() * canvasWidth;
      y = canvasHeight + Math.random() * canvasHeight * 0.1;
      break;
    case 'left':
      vx = -speed;
      vy = (Math.random() - 0.5) * speed * 0.3;
      x = canvasWidth + Math.random() * canvasWidth * 0.1;
      y = Math.random() * canvasHeight;
      break;
    case 'right':
      vx = speed;
      vy = (Math.random() - 0.5) * speed * 0.3;
      x = -Math.random() * canvasWidth * 0.1;
      y = Math.random() * canvasHeight;
      break;
    case 'random': {
      const angle = Math.random() * Math.PI * 2;
      vx = Math.cos(angle) * speed;
      vy = Math.sin(angle) * speed;
      break;
    }
  }

  return {
    x,
    y,
    vx,
    vy,
    size,
    color,
    alpha,
    life: 1,
    maxLife,
    trail: [],
  };
}

// ── Update ───────────────────────────────────────────────

/**
 * Update all particles in the pool. Returns the number of active particles.
 */
export function updatePool(
  pool: ParticlePool,
  dt: number,
  config: SpawnConfig,
): number {
  const { canvasWidth, canvasHeight, condition, params } = config;
  const particles = pool.particles;

  // Update existing particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt / p.maxLife;

    if (p.life <= 0 || isOffScreen(p, canvasWidth, canvasHeight)) {
      // Recycle: replace with a new particle
      particles[i] = spawnParticle(config);
      continue;
    }

    // Snow horizontal drift (sine wave)
    if (condition === 'snow') {
      p.vx = Math.sin(p.y * 0.01 + p.x * 0.005) * 0.8;
    }

    // Wind trail
    if (condition === 'wind') {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 6) {
        p.trail.shift();
      }
    }

    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;

    // Cloud cover affects particle alpha
    p.alpha = Math.min(p.alpha, 1 - params.cloudCover * 0.3);
  }

  // Spawn new particles to fill pool
  const spawnRate = getSpawnRate(condition, params);
  const toSpawn = Math.min(
    Math.ceil(spawnRate * dt),
    pool.maxCount - particles.length,
  );

  for (let i = 0; i < toSpawn; i++) {
    particles.push(spawnParticle(config));
  }

  return particles.length;
}

function getSpawnRate(condition: WeatherCondition, params: NormalizedParams): number {
  const density = 0.5 + params.humidity * 0.5;
  const baseRates: Record<WeatherCondition, number> = {
    rain: 30,
    snow: 10,
    clear: 15,
    cloudy: 5,
    storm: 40,
    wind: 25,
  };
  return baseRates[condition] * density;
}

function isOffScreen(p: Particle, w: number, h: number): boolean {
  const margin = 50;
  return p.x < -margin || p.x > w + margin || p.y < -margin || p.y > h + margin;
}

// ── Draw ─────────────────────────────────────────────────

/**
 * Draw all particles onto the canvas context.
 */
export function drawPool(
  pool: ParticlePool,
  ctx: CanvasRenderingContext2D,
  condition: WeatherCondition,
): void {
  for (const p of pool.particles) {
    const alpha = p.alpha * Math.min(p.life, 1);
    if (alpha <= 0.01) continue;

    ctx.save();

    switch (condition) {
      case 'rain':
        drawRainParticle(ctx, p, alpha);
        break;
      case 'snow':
        drawSnowParticle(ctx, p, alpha);
        break;
      case 'clear':
        drawClearParticle(ctx, p, alpha);
        break;
      case 'cloudy':
        drawCloudyParticle(ctx, p, alpha);
        break;
      case 'storm':
        drawStormParticle(ctx, p, alpha);
        break;
      case 'wind':
        drawWindParticle(ctx, p, alpha);
        break;
    }

    ctx.restore();
  }
}

function drawRainParticle(ctx: CanvasRenderingContext2D, p: Particle, alpha: number): void {
  const color = p.color;
  ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
  ctx.lineWidth = p.size;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x - p.vx * 0.3, p.y - p.vy * 0.3);
  ctx.stroke();
}

function drawSnowParticle(ctx: CanvasRenderingContext2D, p: Particle, alpha: number): void {
  const color = p.color;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgbaToString([color[0], color[1], color[2], 1]);

  // Soft blur effect via shadow
  ctx.shadowColor = rgbaToString([color[0], color[1], color[2], 0.5]);
  ctx.shadowBlur = p.size * 2;

  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fill();
}

function drawClearParticle(ctx: CanvasRenderingContext2D, p: Particle, alpha: number): void {
  const color = p.color;
  const isGlow = p.size > 5;

  if (isGlow) {
    // Radial glow
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
    gradient.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${alpha})`);
    gradient.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = rgbaToString([color[0], color[1], color[2], 1]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCloudyParticle(ctx: CanvasRenderingContext2D, p: Particle, alpha: number): void {
  const color = p.color;
  const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
  gradient.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${alpha * 0.5})`);
  gradient.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fill();
}

function drawStormParticle(ctx: CanvasRenderingContext2D, p: Particle, alpha: number): void {
  // Storm draws either as rain-like or as burst sparks
  if (p.vy > 2) {
    drawRainParticle(ctx, p, alpha);
  } else {
    const color = p.color;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = rgbaToString([color[0], color[1], color[2], 1]);
    ctx.shadowColor = rgbaToString([color[0], color[1], color[2], 0.8]);
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWindParticle(ctx: CanvasRenderingContext2D, p: Particle, alpha: number): void {
  const color = p.color;

  // Draw trail
  if (p.trail.length > 1) {
    ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha * 0.3})`;
    ctx.lineWidth = p.size * 0.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.trail[0].x, p.trail[0].y);
    for (let i = 1; i < p.trail.length; i++) {
      ctx.lineTo(p.trail[i].x, p.trail[i].y);
    }
    ctx.stroke();
  }

  // Draw head
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgbaToString([color[0], color[1], color[2], 1]);
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fill();
}

// ── Profile-driven update ───────────────────────────────

/**
 * Update all particles in the pool using profile mode config.
 * Returns the number of active particles.
 */
export function updatePoolWithProfile(
  pool: ParticlePool,
  dt: number,
  config: ProfileSpawnConfig,
): number {
  const { canvasWidth, canvasHeight, profileMode, params } = config;
  const particles = pool.particles;
  const drawStyle = profileMode.drawStyle;

  // Update existing particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt / p.maxLife;

    if (p.life <= 0 || isOffScreen(p, canvasWidth, canvasHeight)) {
      particles[i] = spawnProfileParticle(config);
      continue;
    }

    // Track trail for trail draw style
    if (drawStyle === 'trail') {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 6) {
        p.trail.shift();
      }
    }

    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;

    // Cloud cover affects particle alpha
    p.alpha = Math.min(p.alpha, 1 - params.cloudCover * 0.3);
  }

  // Spawn new particles to fill pool
  const toSpawn = Math.min(
    Math.ceil(profileMode.spawnRate * dt),
    pool.maxCount - particles.length,
  );

  for (let i = 0; i < toSpawn; i++) {
    particles.push(spawnProfileParticle(config));
  }

  return particles.length;
}

// ── Profile-driven draw ─────────────────────────────────

/**
 * Draw all particles using a profile-driven draw style.
 */
export function drawPoolWithProfile(
  pool: ParticlePool,
  ctx: CanvasRenderingContext2D,
  drawStyle: ProfileModeConfig['drawStyle'],
): void {
  for (const p of pool.particles) {
    const alpha = p.alpha * Math.min(p.life, 1);
    if (alpha <= 0.01) continue;

    ctx.save();

    switch (drawStyle) {
      case 'circle':
        drawCircleParticle(ctx, p, alpha);
        break;
      case 'line':
        drawLineParticle(ctx, p, alpha);
        break;
      case 'glow':
        drawGlowParticle(ctx, p, alpha);
        break;
      case 'trail':
        drawTrailParticle(ctx, p, alpha);
        break;
    }

    ctx.restore();
  }
}

/** Filled circle — like snow/cloudy/clear small particles */
function drawCircleParticle(ctx: CanvasRenderingContext2D, p: Particle, alpha: number): void {
  const color = p.color;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgbaToString([color[0], color[1], color[2], 1]);
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fill();
}

/** Stroked line with motion trail — like rain */
function drawLineParticle(ctx: CanvasRenderingContext2D, p: Particle, alpha: number): void {
  const color = p.color;
  ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
  ctx.lineWidth = p.size;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x - p.vx * 0.3, p.y - p.vy * 0.3);
  ctx.stroke();
}

/** Radial gradient glow — like clear large particles */
function drawGlowParticle(ctx: CanvasRenderingContext2D, p: Particle, alpha: number): void {
  const color = p.color;
  const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
  gradient.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${alpha})`);
  gradient.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fill();
}

/** Polyline trail of last N positions — like wind */
function drawTrailParticle(ctx: CanvasRenderingContext2D, p: Particle, alpha: number): void {
  const color = p.color;

  if (p.trail.length > 1) {
    ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${alpha * 0.3})`;
    ctx.lineWidth = p.size * 0.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.trail[0].x, p.trail[0].y);
    for (let i = 1; i < p.trail.length; i++) {
      ctx.lineTo(p.trail[i].x, p.trail[i].y);
    }
    ctx.stroke();
  }

  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgbaToString([color[0], color[1], color[2], 1]);
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fill();
}
