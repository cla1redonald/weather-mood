/**
 * Thunder rumble sub-layer: low sine oscillator + brown noise through a low
 * bandpass filter, with envelope-triggered rumbles at random intervals.
 */

import type { SoundscapeProfile } from '@/types/mood';
import { fillBrownNoise } from './noise';

const NOISE_BUFFER_SIZE = 2 * 44100; // 2 seconds at 44.1kHz
const SINE_FREQ = 40; // Hz — sub-bass rumble
const BANDPASS_FREQ = 60; // Hz — filter center
const BANDPASS_Q = 2;
const ATTACK_TIME = 0.05; // seconds
const MIN_DECAY = 2; // seconds
const MAX_DECAY = 4; // seconds

export interface ThunderLayer {
  /** Trigger a single thunder rumble */
  trigger(now: number): void;
  /** Start the self-scheduling random timer */
  startScheduler(): void;
  /** Enable or disable the thunder layer */
  setActive(active: boolean, now: number, rampDuration: number): void;
  /** Apply an AI-generated thunder profile */
  applyProfile(thunder: SoundscapeProfile['thunder']): void;
  /** Clean up timer and nodes */
  destroy(): void;
}

export function createThunderLayer(
  ctx: AudioContext,
  destination: AudioNode,
): ThunderLayer {
  // Brown noise source
  const noiseBuffer = ctx.createBuffer(1, NOISE_BUFFER_SIZE, ctx.sampleRate);
  fillBrownNoise(noiseBuffer.getChannelData(0));

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;
  noiseSource.loop = true;

  // Bandpass filter on noise
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(BANDPASS_FREQ, ctx.currentTime);
  bandpass.Q.setValueAtTime(BANDPASS_Q, ctx.currentTime);

  // Low sine oscillator for sub-bass
  const sineOsc = ctx.createOscillator();
  sineOsc.type = 'sine';
  sineOsc.frequency.setValueAtTime(SINE_FREQ, ctx.currentTime);

  // Envelope gain — both noise and sine feed into this
  const envelopeGain = ctx.createGain();
  envelopeGain.gain.setValueAtTime(0, ctx.currentTime);

  // Master gain for the whole thunder layer (used for active/inactive)
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, ctx.currentTime);

  // Routing: noise -> bandpass -> envelope, sine -> envelope, envelope -> master -> destination
  noiseSource.connect(bandpass);
  bandpass.connect(envelopeGain);
  sineOsc.connect(envelopeGain);
  envelopeGain.connect(masterGain);
  masterGain.connect(destination);

  noiseSource.start(ctx.currentTime);
  sineOsc.start(ctx.currentTime);

  // Profile state
  let intensity = 0.5;
  let intervalMin = 5;
  let intervalMax = 15;
  let active = false;
  let schedulerTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;

  function getRandomInterval(): number {
    return intervalMin + Math.random() * (intervalMax - intervalMin);
  }

  function scheduleNext() {
    if (destroyed || !active) return;
    const delay = getRandomInterval() * 1000; // convert to ms
    schedulerTimer = setTimeout(() => {
      if (destroyed || !active) return;
      trigger(ctx.currentTime);
      scheduleNext();
    }, delay);
  }

  function trigger(now: number) {
    const decay = MIN_DECAY + Math.random() * (MAX_DECAY - MIN_DECAY);
    // Fast attack to intensity, then exponential decay
    envelopeGain.gain.cancelScheduledValues(now);
    envelopeGain.gain.setValueAtTime(0, now);
    envelopeGain.gain.linearRampToValueAtTime(intensity, now + ATTACK_TIME);
    envelopeGain.gain.setTargetAtTime(0, now + ATTACK_TIME, decay / 5);
  }

  return {
    trigger,

    startScheduler() {
      if (!active || destroyed) return;
      scheduleNext();
    },

    setActive(newActive: boolean, now: number, rampDuration: number) {
      active = newActive;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(
        newActive ? 1 : 0,
        now + rampDuration,
      );

      if (newActive) {
        scheduleNext();
      } else if (schedulerTimer !== null) {
        clearTimeout(schedulerTimer);
        schedulerTimer = null;
      }
    },

    applyProfile(thunder: SoundscapeProfile['thunder']) {
      intensity = thunder.intensity;
      intervalMin = thunder.intervalMin;
      intervalMax = thunder.intervalMax;

      const now = ctx.currentTime;
      const rampDuration = 3;

      if (thunder.active && !active) {
        active = true;
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.linearRampToValueAtTime(1, now + rampDuration);
        scheduleNext();
      } else if (!thunder.active && active) {
        active = false;
        if (schedulerTimer !== null) {
          clearTimeout(schedulerTimer);
          schedulerTimer = null;
        }
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.linearRampToValueAtTime(0, now + rampDuration);
      }
    },

    destroy() {
      destroyed = true;
      if (schedulerTimer !== null) {
        clearTimeout(schedulerTimer);
        schedulerTimer = null;
      }
      try {
        noiseSource.stop();
      } catch {
        // Already stopped
      }
      try {
        sineOsc.stop();
      } catch {
        // Already stopped
      }
      noiseSource.disconnect();
      bandpass.disconnect();
      sineOsc.disconnect();
      envelopeGain.disconnect();
      masterGain.disconnect();
    },
  };
}
