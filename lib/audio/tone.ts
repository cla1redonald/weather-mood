/**
 * Base tone layer: harmonic bank whose fundamental frequency maps to temperature.
 * Cold (0.0) = 80Hz drone, Hot (1.0) = 300Hz warmer tone.
 *
 * Supports 3 oscillators: fundamental + 2nd harmonic + 3rd harmonic.
 * The harmonics are silent by default and activated via applyProfile().
 */

import type { SoundscapeProfile } from '@/types/mood';

const MIN_FREQ = 80;
const MAX_FREQ = 300;
const TONE_GAIN = 0.15;

/** Map temperature (0-1) to oscillator frequency in Hz */
export function temperatureToFrequency(temperature: number): number {
  const t = Math.max(0, Math.min(1, temperature));
  return MIN_FREQ + t * (MAX_FREQ - MIN_FREQ);
}

export interface ToneLayer {
  /** The input node to connect sources into this layer's chain */
  input: GainNode;
  /** Update the tone frequency based on temperature (fallback path) */
  update(temperature: number, now: number, rampDuration: number): void;
  /** Apply an AI-generated tone profile */
  applyProfile(tone: SoundscapeProfile['tone'], now: number, rampDuration: number): void;
  /** Clean up all nodes */
  destroy(): void;
}

export function createToneLayer(
  ctx: AudioContext,
  destination: AudioNode,
): ToneLayer {
  // Fundamental oscillator
  const fundamental = ctx.createOscillator();
  const fundamentalGain = ctx.createGain();
  fundamental.type = 'sine';
  fundamental.frequency.setValueAtTime(temperatureToFrequency(0.5), ctx.currentTime);
  fundamentalGain.gain.setValueAtTime(TONE_GAIN, ctx.currentTime);
  fundamental.connect(fundamentalGain);
  fundamentalGain.connect(destination);
  fundamental.start(ctx.currentTime);

  // 2nd harmonic oscillator (silent by default)
  const harmonic2 = ctx.createOscillator();
  const harmonic2Gain = ctx.createGain();
  harmonic2.type = 'sine';
  harmonic2.frequency.setValueAtTime(temperatureToFrequency(0.5) * 2, ctx.currentTime);
  harmonic2Gain.gain.setValueAtTime(0, ctx.currentTime);
  harmonic2.connect(harmonic2Gain);
  harmonic2Gain.connect(destination);
  harmonic2.start(ctx.currentTime);

  // 3rd harmonic oscillator (silent by default)
  const harmonic3 = ctx.createOscillator();
  const harmonic3Gain = ctx.createGain();
  harmonic3.type = 'sine';
  harmonic3.frequency.setValueAtTime(temperatureToFrequency(0.5) * 3, ctx.currentTime);
  harmonic3Gain.gain.setValueAtTime(0, ctx.currentTime);
  harmonic3.connect(harmonic3Gain);
  harmonic3Gain.connect(destination);
  harmonic3.start(ctx.currentTime);

  return {
    input: fundamentalGain,

    update(temperature: number, now: number, rampDuration: number) {
      const freq = temperatureToFrequency(temperature);

      // Update fundamental
      fundamental.frequency.cancelScheduledValues(now);
      fundamental.frequency.setValueAtTime(fundamental.frequency.value, now);
      fundamental.frequency.linearRampToValueAtTime(freq, now + rampDuration);

      // Keep harmonics tracking the fundamental (even if silent)
      harmonic2.frequency.cancelScheduledValues(now);
      harmonic2.frequency.setValueAtTime(harmonic2.frequency.value, now);
      harmonic2.frequency.linearRampToValueAtTime(freq * 2, now + rampDuration);

      harmonic3.frequency.cancelScheduledValues(now);
      harmonic3.frequency.setValueAtTime(harmonic3.frequency.value, now);
      harmonic3.frequency.linearRampToValueAtTime(freq * 3, now + rampDuration);
    },

    applyProfile(tone: SoundscapeProfile['tone'], now: number, rampDuration: number) {
      // Set fundamental frequency and waveform
      fundamental.type = tone.waveform;
      fundamental.frequency.cancelScheduledValues(now);
      fundamental.frequency.setValueAtTime(fundamental.frequency.value, now);
      fundamental.frequency.linearRampToValueAtTime(tone.frequency, now + rampDuration);

      fundamentalGain.gain.cancelScheduledValues(now);
      fundamentalGain.gain.setValueAtTime(fundamentalGain.gain.value, now);
      fundamentalGain.gain.linearRampToValueAtTime(tone.gain, now + rampDuration);

      // Set 2nd harmonic: frequency * 2, with profile gain
      harmonic2.type = tone.harmonics.waveform;
      harmonic2.frequency.cancelScheduledValues(now);
      harmonic2.frequency.setValueAtTime(harmonic2.frequency.value, now);
      harmonic2.frequency.linearRampToValueAtTime(tone.frequency * 2, now + rampDuration);

      harmonic2Gain.gain.cancelScheduledValues(now);
      harmonic2Gain.gain.setValueAtTime(harmonic2Gain.gain.value, now);
      harmonic2Gain.gain.linearRampToValueAtTime(tone.harmonics.second, now + rampDuration);

      // Set 3rd harmonic: frequency * 3, with profile gain
      harmonic3.type = tone.harmonics.waveform;
      harmonic3.frequency.cancelScheduledValues(now);
      harmonic3.frequency.setValueAtTime(harmonic3.frequency.value, now);
      harmonic3.frequency.linearRampToValueAtTime(tone.frequency * 3, now + rampDuration);

      harmonic3Gain.gain.cancelScheduledValues(now);
      harmonic3Gain.gain.setValueAtTime(harmonic3Gain.gain.value, now);
      harmonic3Gain.gain.linearRampToValueAtTime(tone.harmonics.third, now + rampDuration);
    },

    destroy() {
      try {
        fundamental.stop();
      } catch {
        // Already stopped
      }
      try {
        harmonic2.stop();
      } catch {
        // Already stopped
      }
      try {
        harmonic3.stop();
      } catch {
        // Already stopped
      }
      fundamental.disconnect();
      fundamentalGain.disconnect();
      harmonic2.disconnect();
      harmonic2Gain.disconnect();
      harmonic3.disconnect();
      harmonic3Gain.disconnect();
    },
  };
}
