import type { WeatherCondition, NormalizedParams } from '@/types/weather';
import type { VisualProfile } from '@/types/mood';
import { getPalette, lerpColor, profileToPalette, type WeatherPalette, type RGBA } from './palette';
import {
  createPool, updatePool, drawPool, getMaxParticles,
  updatePoolWithProfile, drawPoolWithProfile, spawnProfileParticle,
  type ParticlePool, type ProfileSpawnConfig,
} from './particles';
import {
  drawBackground, drawForeground, resetModeState,
  createProfileMode, drawProfileBackground, drawProfileForeground,
  type ProfileModeConfig,
} from './modes';

// ── Renderer config ──────────────────────────────────────

export interface RendererConfig {
  condition: WeatherCondition;
  params: NormalizedParams;
  visualProfile?: VisualProfile | null;
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

  // Profile mode state
  let profileMode: ProfileModeConfig | null = null;
  let profilePalette: WeatherPalette | null = null;

  // Profile crossfade state
  let profileCrossfadeProgress = 1; // 1 = complete (no crossfade)
  let preCrossfadePalette: WeatherPalette | null = null;
  const PROFILE_CROSSFADE_DURATION = 2; // seconds

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
    let maxParticles = profileMode
      ? profileMode.maxCount
      : getMaxParticles(getWidth(), currentCondition);

    // Reduce particle count if user prefers reduced motion
    if (prefersReducedMotion) {
      maxParticles = Math.floor(maxParticles * 0.5);
    }

    pool.maxCount = maxParticles;
  }

  // ── Animation loop ───────────────────────────────────

  /**
   * Interpolate between two WeatherPalettes, lerping each corresponding color.
   */
  function lerpPalette(a: WeatherPalette, b: WeatherPalette, t: number): WeatherPalette {
    const bgLen = Math.max(a.background.length, b.background.length);
    const pLen = Math.max(a.particles.length, b.particles.length);
    const background: RGBA[] = [];
    const particles: RGBA[] = [];
    for (let i = 0; i < bgLen; i++) {
      const ca = a.background[i] ?? a.background[a.background.length - 1];
      const cb = b.background[i] ?? b.background[b.background.length - 1];
      background.push(lerpColor(ca, cb, t));
    }
    for (let i = 0; i < pLen; i++) {
      const ca = a.particles[i] ?? a.particles[a.particles.length - 1];
      const cb = b.particles[i] ?? b.particles[b.particles.length - 1];
      particles.push(lerpColor(ca, cb, t));
    }
    return { background, particles };
  }

  function frame(timestamp: number): void {
    if (!running) return;

    const dt = lastTime === 0 ? 0.016 : Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    const w = getWidth();
    const h = getHeight();

    // Handle condition transition (non-profile mode)
    if (transitionProgress < 1 && !profileMode) {
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

    // Handle profile crossfade
    if (profileCrossfadeProgress < 1) {
      profileCrossfadeProgress = Math.min(1, profileCrossfadeProgress + dt / PROFILE_CROSSFADE_DURATION);

      if (profileMode && profilePalette && preCrossfadePalette) {
        // Interpolate palette during crossfade
        const blendedPalette = lerpPalette(preCrossfadePalette, profilePalette, profileCrossfadeProgress);
        profileMode.palette = blendedPalette;

        if (profileCrossfadeProgress >= 1) {
          // Crossfade complete — use final palette
          profileMode.palette = profilePalette;
          preCrossfadePalette = null;
        }
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

    if (profileMode) {
      // ── Profile-driven rendering ──────────────
      drawProfileBackground(ctx!, w, h, profileMode, currentParams, dt);

      const profileConfig: ProfileSpawnConfig = {
        canvasWidth: w,
        canvasHeight: h,
        profileMode,
        params: currentParams,
      };
      updatePoolWithProfile(pool, dt, profileConfig);
      drawPoolWithProfile(pool, ctx!, profileMode.drawStyle);

      drawProfileForeground(ctx!, w, h, profileMode, dt);
    } else {
      // ── Condition-driven rendering (fallback) ──
      drawBackground(ctx!, w, h, currentCondition, currentParams, currentPalette, dt);

      updatePool(pool, dt, {
        canvasWidth: w,
        canvasHeight: h,
        condition: currentCondition,
        params: currentParams,
        palette: currentPalette,
      });
      drawPool(pool, ctx!, currentCondition);

      drawForeground(ctx!, w, h, currentCondition, currentParams, dt);
    }

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
    profileCrossfadeProgress = 1;

    // Apply visual profile if provided
    if (config.visualProfile) {
      profileMode = createProfileMode(config.visualProfile);
      profilePalette = profileToPalette(config.visualProfile);
      profileMode.palette = profilePalette;
      preCrossfadePalette = null;
    } else {
      profileMode = null;
      profilePalette = null;
      preCrossfadePalette = null;
    }

    setupCanvas();
    let maxParticles = profileMode
      ? profileMode.maxCount
      : getMaxParticles(getWidth(), currentCondition);

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

    // Handle visual profile arriving or changing
    if (config.visualProfile) {
      const newProfileMode = createProfileMode(config.visualProfile);
      const newProfilePalette = profileToPalette(config.visualProfile);

      console.log('[renderer] profile mode ON, bg:', newProfilePalette.background.map(c => `rgb(${c[0]},${c[1]},${c[2]})`));

      // Capture the palette to crossfade FROM
      preCrossfadePalette = profileMode
        ? { ...profileMode.palette }
        : { ...currentPalette };

      profileMode = newProfileMode;
      profilePalette = newProfilePalette;
      profileCrossfadeProgress = 0;

      // Update pool max count (don't kill existing particles — let them die naturally)
      let maxCount = profileMode.maxCount;
      if (prefersReducedMotion) {
        maxCount = Math.floor(maxCount * 0.5);
      }
      pool.maxCount = maxCount;

      // Update condition and params
      currentCondition = config.condition;
      currentParams = config.params;
      return;
    }

    // Profile was removed — revert to condition-based mode
    if (!config.visualProfile && profileMode) {
      preCrossfadePalette = { ...profileMode.palette };
      profileMode = null;
      profilePalette = null;
      currentCondition = config.condition;
      currentParams = config.params;
      currentPalette = getPalette(currentCondition);

      // Rebuild pool for condition mode
      const w = getWidth();
      let maxParticles = getMaxParticles(w, currentCondition);
      if (prefersReducedMotion) {
        maxParticles = Math.floor(maxParticles * 0.5);
      }
      pool.maxCount = maxParticles;
      resetModeState();
      return;
    }

    // Standard condition-based transitions (no profile)
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
    profileMode = null;
    profilePalette = null;
    preCrossfadePalette = null;
    profileCrossfadeProgress = 1;
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
