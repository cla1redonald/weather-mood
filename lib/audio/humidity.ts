/**
 * Humidity filter layer: a low-pass filter + highshelf on the output chain.
 *
 * Dry (0.0) = high cutoff (4000Hz, crisp/bright)
 * Humid (1.0) = low cutoff (800Hz, muffled/warm)
 * Q (resonance) fixed at 1.0 by default (subtle)
 *
 * The highshelf filter is silent by default (0dB gain) and activated via
 * applyProfile() for atmosphere dampening.
 */

import type { SoundscapeProfile } from '@/types/mood';

const MAX_CUTOFF = 4000; // Hz (dry)
const MIN_CUTOFF = 800; // Hz (humid)
const FILTER_Q = 1.0;

/** Map humidity (0-1) to low-pass filter cutoff frequency in Hz */
export function humidityToCutoff(humidity: number): number {
  const h = Math.max(0, Math.min(1, humidity));
  // Inverted: higher humidity = lower cutoff
  return MAX_CUTOFF - h * (MAX_CUTOFF - MIN_CUTOFF);
}

export interface HumidityFilter {
  /** The input node where upstream audio connects */
  input: BiquadFilterNode;
  /** Update filter cutoff based on humidity (fallback path) */
  update(humidity: number, now: number, rampDuration: number): void;
  /** Apply an AI-generated filter profile */
  applyProfile(filter: SoundscapeProfile['filter'], now: number, rampDuration: number): void;
  /** Clean up all nodes */
  destroy(): void;
}

export function createHumidityFilter(
  ctx: AudioContext,
  destination: AudioNode,
): HumidityFilter {
  // Primary low-pass filter
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(humidityToCutoff(0.5), ctx.currentTime);
  lowpass.Q.setValueAtTime(FILTER_Q, ctx.currentTime);

  // Highshelf filter in series (after lowpass)
  const highshelf = ctx.createBiquadFilter();
  highshelf.type = 'highshelf';
  highshelf.frequency.setValueAtTime(2000, ctx.currentTime); // shelf starts at 2kHz
  highshelf.gain.setValueAtTime(0, ctx.currentTime); // neutral by default (0dB)

  // Chain: lowpass -> highshelf -> destination
  lowpass.connect(highshelf);
  highshelf.connect(destination);

  return {
    input: lowpass,

    update(humidity: number, now: number, rampDuration: number) {
      const cutoff = humidityToCutoff(humidity);
      lowpass.frequency.cancelScheduledValues(now);
      lowpass.frequency.setValueAtTime(lowpass.frequency.value, now);
      lowpass.frequency.linearRampToValueAtTime(cutoff, now + rampDuration);
    },

    applyProfile(filter: SoundscapeProfile['filter'], now: number, rampDuration: number) {
      // Set lowpass cutoff
      lowpass.frequency.cancelScheduledValues(now);
      lowpass.frequency.setValueAtTime(lowpass.frequency.value, now);
      lowpass.frequency.linearRampToValueAtTime(filter.cutoff, now + rampDuration);

      // Set lowpass Q
      lowpass.Q.cancelScheduledValues(now);
      lowpass.Q.setValueAtTime(lowpass.Q.value, now);
      lowpass.Q.linearRampToValueAtTime(filter.Q, now + rampDuration);

      // Set highshelf gain (atmosphere dampening)
      highshelf.gain.cancelScheduledValues(now);
      highshelf.gain.setValueAtTime(highshelf.gain.value, now);
      highshelf.gain.linearRampToValueAtTime(filter.highShelfGain, now + rampDuration);
    },

    destroy() {
      lowpass.disconnect();
      highshelf.disconnect();
    },
  };
}
