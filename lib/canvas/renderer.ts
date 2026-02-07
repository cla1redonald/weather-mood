import type { WeatherCondition, NormalizedParams } from '@/types/weather';
import { getPalette, type WeatherPalette } from './palette';
import { createPool, updatePool, drawPool, getMaxParticles, type ParticlePool } from './particles';
import { drawBackground, drawForeground, resetModeState } from './modes';

// ── Renderer config ──────────────────────────────────────

export interface RendererConfig {
  condition: WeatherCondition;
  params: NormalizedParams;
}

// ── Canvas renderer ──────────────────────────────────────

export interface CanvasRenderer {
  /** Start the animation loop */
  start: (config: RendererConfig) => void;
  /** Update weather parameters (smooth transition) */
  update: (config: RendererConfig) => void;
  /** Stop the animation loop and clean up */
  destroy: () => void;
  /** Whether the renderer is running */
  isRunning: () => boolean;
}

/**
 * Create a canvas renderer bound to a canvas element.
 */
export function createRenderer(canvas: HTMLCanvasElement): CanvasRenderer {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d rendering context');

  let animationId: number | null = null;
  let lastTime = 0;
  let running = false;

  // Current state
  let currentCondition: WeatherCondition = 'clear';
  let currentParams: NormalizedParams = { temperature: 0.5, humidity: 0.5, windSpeed: 0, cloudCover: 0 };
  let currentPalette: WeatherPalette = getPalette('clear');
  let pool: ParticlePool = createPool(250);

  // Transition state
  let targetCondition: WeatherCondition | null = null;
  let targetParams: NormalizedParams | null = null;
  let transitionProgress = 1; // 1 = no transition
  const TRANSITION_DURATION = 2; // seconds

  // Fade-in state
  let fadeInProgress = 0;
  const FADE_IN_DURATION = 1; // seconds

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── DPI scaling ──────────────────────────────────────

  function setupCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx!.scale(dpr, dpr);
  }

  function getWidth(): number {
    return canvas.getBoundingClientRect().width;
  }

  function getHeight(): number {
    return canvas.getBoundingClientRect().height;
  }

  // ── Resize handler ───────────────────────────────────

  function handleResize(): void {
    setupCanvas();
    let maxParticles = getMaxParticles(getWidth(), currentCondition);

    // Reduce particle count if user prefers reduced motion
    if (prefersReducedMotion) {
      maxParticles = Math.floor(maxParticles * 0.5);
    }

    pool.maxCount = maxParticles;
  }

  // ── Animation loop ───────────────────────────────────

  function frame(timestamp: number): void {
    if (!running) return;

    const dt = lastTime === 0 ? 0.016 : Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    const w = getWidth();
    const h = getHeight();

    // Handle transition
    if (transitionProgress < 1) {
      transitionProgress = Math.min(1, transitionProgress + dt / TRANSITION_DURATION);

      if (transitionProgress >= 1 && targetCondition !== null) {
        currentCondition = targetCondition;
        currentParams = targetParams ?? currentParams;
        currentPalette = getPalette(currentCondition);
        targetCondition = null;
        targetParams = null;

        // Reset pool for new condition
        const maxParticles = getMaxParticles(w, currentCondition);
        pool = createPool(maxParticles);
        resetModeState();
      } else if (targetParams) {
        // Interpolate params during transition
        currentParams = lerpParams(currentParams, targetParams, transitionProgress);
      }
    }

    // Handle fade-in
    if (fadeInProgress < 1) {
      fadeInProgress = Math.min(1, fadeInProgress + dt / FADE_IN_DURATION);
    }

    // Clear
    ctx!.clearRect(0, 0, w, h);

    // Apply fade-in
    if (fadeInProgress < 1) {
      ctx!.globalAlpha = fadeInProgress;
    }

    // Draw background
    drawBackground(ctx!, w, h, currentCondition, currentParams, currentPalette, dt);

    // Update and draw particles
    updatePool(pool, dt, {
      canvasWidth: w,
      canvasHeight: h,
      condition: currentCondition,
      params: currentParams,
      palette: currentPalette,
    });
    drawPool(pool, ctx!, currentCondition);

    // Draw foreground effects
    drawForeground(ctx!, w, h, currentCondition, currentParams, dt);

    // Reset alpha
    ctx!.globalAlpha = 1;

    animationId = requestAnimationFrame(frame);
  }

  // ── Public API ───────────────────────────────────────

  function start(config: RendererConfig): void {
    if (running) return;

    currentCondition = config.condition;
    currentParams = config.params;
    currentPalette = getPalette(currentCondition);
    fadeInProgress = 0;
    transitionProgress = 1;

    setupCanvas();
    let maxParticles = getMaxParticles(getWidth(), currentCondition);

    // Reduce particle count if user prefers reduced motion
    if (prefersReducedMotion) {
      maxParticles = Math.floor(maxParticles * 0.5);
    }

    pool = createPool(maxParticles);
    resetModeState();

    running = true;
    lastTime = 0;
    window.addEventListener('resize', handleResize);
    animationId = requestAnimationFrame(frame);
  }

  function update(config: RendererConfig): void {
    if (!running) {
      start(config);
      return;
    }

    if (config.condition !== currentCondition) {
      // Start a cross-fade transition
      targetCondition = config.condition;
      targetParams = config.params;
      transitionProgress = 0;
    } else {
      // Same condition, smoothly interpolate params
      targetParams = config.params;
      transitionProgress = 0.5; // Short param-only transition
    }
  }

  function destroy(): void {
    running = false;
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    window.removeEventListener('resize', handleResize);
    pool.particles.length = 0;
    resetModeState();
    lastTime = 0;
  }

  function isRunning(): boolean {
    return running;
  }

  return { start, update, destroy, isRunning };
}

// ── Helpers ──────────────────────────────────────────────

function lerpParams(a: NormalizedParams, b: NormalizedParams, t: number): NormalizedParams {
  return {
    temperature: a.temperature + (b.temperature - a.temperature) * t,
    humidity: a.humidity + (b.humidity - a.humidity) * t,
    windSpeed: a.windSpeed + (b.windSpeed - a.windSpeed) * t,
    cloudCover: a.cloudCover + (b.cloudCover - a.cloudCover) * t,
  };
}
