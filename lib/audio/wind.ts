/**
 * Wind layer: LFO (low-frequency oscillator) modulating the amplitude of the
 * base tone to create a wobble/tremolo effect, with stochastic gust modulation
 * using simplex noise.
 *
 * Calm (0.0) = barely perceptible wobble (0.5Hz, depth 0.05)
 * Gale (1.0) = rapid tremolo (4Hz, depth 0.4)
 */

import { createNoise2D } from 'simplex-noise';
import type { SoundscapeProfile } from '@/types/mood';

const MIN_RATE = 0.5; // Hz
const MAX_RATE = 4; // Hz
const MIN_DEPTH = 0.05;
const MAX_DEPTH = 0.4;

const GUST_INTERVAL = 100; // ms between gust samples

/** Map wind speed (0-1) to LFO rate in Hz */
export function windToLfoRate(windSpeed: number): number {
  const w = Math.max(0, Math.min(1, windSpeed));
  return MIN_RATE + w * (MAX_RATE - MIN_RATE);
}

/** Map wind speed (0-1) to LFO modulation depth */
export function windToLfoDepth(windSpeed: number): number {
  const w = Math.max(0, Math.min(1, windSpeed));
  return MIN_DEPTH + w * (MAX_DEPTH - MIN_DEPTH);
}

export interface WindLayer {
  /** The input node where upstream audio connects */
  input: GainNode;
  /** Update LFO rate and depth based on wind speed (fallback path) */
  update(windSpeed: number, now: number, rampDuration: number): void;
  /** Apply an AI-generated wind profile */
  applyProfile(wind: SoundscapeProfile['wind'], now: number, rampDuration: number): void;
  /** Clean up all nodes */
  destroy(): void;
}

export function createWindLayer(
  ctx: AudioContext,
  destination: AudioNode,
): WindLayer {
  // The modulated gain node that upstream audio passes through
  const modulatedGain = ctx.createGain();
  modulatedGain.gain.setValueAtTime(1, ctx.currentTime);
  modulatedGain.connect(destination);

  // LFO oscillator controls the gain to create tremolo
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();

  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(windToLfoRate(0), ctx.currentTime);

  // LFO output modulates the amplitude of the passthrough gain
  // The depth gain scales the LFO output before connecting to the modulatedGain's gain param
  lfoGain.gain.setValueAtTime(windToLfoDepth(0), ctx.currentTime);

  lfo.connect(lfoGain);
  lfoGain.connect(modulatedGain.gain);
  lfo.start(ctx.currentTime);

  // Gust scheduler: simplex noise modulates LFO depth over time
  const noise2D = createNoise2D();
  let gustIntensity = 0; // 0 = no gusts (fallback mode), >0 = profile mode
  let baseDepth = windToLfoDepth(0);
  let gustTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;
  const startTime = Date.now();

  function scheduleGust() {
    if (destroyed) return;
    gustTimer = setTimeout(() => {
      if (destroyed) return;
      if (gustIntensity > 0) {
        const elapsed = (Date.now() - startTime) / 1000; // seconds
        const noiseVal = noise2D(elapsed * 0.5, 0); // range [-1, 1]
        const gustFactor = 0.5 + noiseVal * 0.5; // map to [0, 1]
        const effectiveDepth = baseDepth * (0.3 + gustFactor * 0.7 * gustIntensity);
        const now = ctx.currentTime;
        lfoGain.gain.cancelScheduledValues(now);
        lfoGain.gain.setValueAtTime(lfoGain.gain.value, now);
        lfoGain.gain.linearRampToValueAtTime(effectiveDepth, now + 0.1);
      }
      scheduleGust();
    }, GUST_INTERVAL);
  }

  // Start the gust scheduler (it only modulates when gustIntensity > 0)
  scheduleGust();

  return {
    input: modulatedGain,

    update(windSpeed: number, now: number, rampDuration: number) {
      const rate = windToLfoRate(windSpeed);
      const depth = windToLfoDepth(windSpeed);

      baseDepth = depth;

      lfo.frequency.cancelScheduledValues(now);
      lfo.frequency.setValueAtTime(lfo.frequency.value, now);
      lfo.frequency.linearRampToValueAtTime(rate, now + rampDuration);

      // Only ramp depth directly when gusts are not active
      if (gustIntensity === 0) {
        lfoGain.gain.cancelScheduledValues(now);
        lfoGain.gain.setValueAtTime(lfoGain.gain.value, now);
        lfoGain.gain.linearRampToValueAtTime(depth, now + rampDuration);
      }
    },

    applyProfile(wind: SoundscapeProfile['wind'], now: number, rampDuration: number) {
      // Set LFO waveform
      lfo.type = wind.lfoWaveform;

      // Set LFO rate
      lfo.frequency.cancelScheduledValues(now);
      lfo.frequency.setValueAtTime(lfo.frequency.value, now);
      lfo.frequency.linearRampToValueAtTime(wind.lfoRate, now + rampDuration);

      // Set base depth and gust intensity
      baseDepth = wind.lfoDepth;
      gustIntensity = wind.gustIntensity;

      // If no gusts, set depth directly
      if (gustIntensity === 0) {
        lfoGain.gain.cancelScheduledValues(now);
        lfoGain.gain.setValueAtTime(lfoGain.gain.value, now);
        lfoGain.gain.linearRampToValueAtTime(wind.lfoDepth, now + rampDuration);
      }
      // Otherwise the gust scheduler will handle depth modulation
    },

    destroy() {
      destroyed = true;
      if (gustTimer !== null) {
        clearTimeout(gustTimer);
        gustTimer = null;
      }
      try {
        lfo.stop();
      } catch {
        // Already stopped
      }
      lfo.disconnect();
      lfoGain.disconnect();
      modulatedGain.disconnect();
    },
  };
}
