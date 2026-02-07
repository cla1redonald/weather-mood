/**
 * Precipitation layer: colored noise through bandpass filters for rain/snow.
 *
 * Supports three noise colors (white, pink, brown) with crossfading.
 * Each noise color has its own BufferSourceNode -> bandpass -> gain chain.
 *
 * Rain: bandpass 1000-3000Hz, gain 0.1, steady
 * Snow: bandpass 2000-6000Hz, gain 0.03, very quiet
 * No precip: silence (gain 0)
 */

import type { WeatherCondition } from '@/types/weather';
import type { SoundscapeProfile } from '@/types/mood';
import { fillWhiteNoise, fillPinkNoise, fillBrownNoise } from './noise';

const NOISE_BUFFER_SIZE = 2 * 44100; // 2 seconds of noise at 44.1kHz

interface PrecipConfig {
  frequency: number; // bandpass center frequency
  Q: number; // bandpass Q
  gain: number;
}

const RAIN_CONFIG: PrecipConfig = {
  frequency: 2000,
  Q: 0.5,
  gain: 0.1,
};

const SNOW_CONFIG: PrecipConfig = {
  frequency: 4000,
  Q: 0.5,
  gain: 0.03,
};

/** Get precipitation config for a weather condition, or null if no precip */
export function getPrecipConfig(
  condition: WeatherCondition,
): PrecipConfig | null {
  switch (condition) {
    case 'rain':
    case 'storm':
      return RAIN_CONFIG;
    case 'snow':
      return SNOW_CONFIG;
    default:
      return null;
  }
}

type NoiseColor = 'white' | 'pink' | 'brown';

interface NoiseChannel {
  source: AudioBufferSourceNode;
  bandpass: BiquadFilterNode;
  gain: GainNode;
}

function createNoiseBuffer(
  ctx: AudioContext,
  fillFn: (data: Float32Array) => void,
): AudioBuffer {
  const buffer = ctx.createBuffer(1, NOISE_BUFFER_SIZE, ctx.sampleRate);
  fillFn(buffer.getChannelData(0));
  return buffer;
}

function createNoiseChannel(
  ctx: AudioContext,
  buffer: AudioBuffer,
  destination: AudioNode,
): NoiseChannel {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(2000, ctx.currentTime);
  bandpass.Q.setValueAtTime(0.5, ctx.currentTime);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime); // Start silent

  source.connect(bandpass);
  bandpass.connect(gain);
  gain.connect(destination);
  source.start(ctx.currentTime);

  return { source, bandpass, gain };
}

export interface PrecipitationLayer {
  /** Update the precipitation layer based on weather condition (fallback path) */
  update(condition: WeatherCondition, now: number, rampDuration: number): void;
  /** Apply an AI-generated precipitation profile */
  applyProfile(precip: SoundscapeProfile['precipitation'], now: number, rampDuration: number): void;
  /** Clean up all nodes */
  destroy(): void;
}

export function createPrecipitationLayer(
  ctx: AudioContext,
  destination: AudioNode,
): PrecipitationLayer {
  // Create noise buffers for each color
  const whiteBuffer = createNoiseBuffer(ctx, fillWhiteNoise);
  const pinkBuffer = createNoiseBuffer(ctx, fillPinkNoise);
  const brownBuffer = createNoiseBuffer(ctx, fillBrownNoise);

  // Create a channel for each noise color
  const channels: Record<NoiseColor, NoiseChannel> = {
    white: createNoiseChannel(ctx, whiteBuffer, destination),
    pink: createNoiseChannel(ctx, pinkBuffer, destination),
    brown: createNoiseChannel(ctx, brownBuffer, destination),
  };

  // Track which color is currently active for the fallback path
  let activeColor: NoiseColor = 'white';

  function setAllBandpass(frequency: number, Q: number, now: number, rampDuration: number) {
    for (const color of ['white', 'pink', 'brown'] as NoiseColor[]) {
      const ch = channels[color];
      ch.bandpass.frequency.cancelScheduledValues(now);
      ch.bandpass.frequency.setValueAtTime(ch.bandpass.frequency.value, now);
      ch.bandpass.frequency.linearRampToValueAtTime(frequency, now + rampDuration);

      ch.bandpass.Q.cancelScheduledValues(now);
      ch.bandpass.Q.setValueAtTime(ch.bandpass.Q.value, now);
      ch.bandpass.Q.linearRampToValueAtTime(Q, now + rampDuration);
    }
  }

  function crossfadeTo(color: NoiseColor, targetGain: number, now: number, rampDuration: number) {
    for (const c of ['white', 'pink', 'brown'] as NoiseColor[]) {
      const ch = channels[c];
      ch.gain.gain.cancelScheduledValues(now);
      ch.gain.gain.setValueAtTime(ch.gain.gain.value, now);
      ch.gain.gain.linearRampToValueAtTime(
        c === color ? targetGain : 0,
        now + rampDuration,
      );
    }
    activeColor = color;
  }

  function silenceAll(now: number, rampDuration: number) {
    for (const color of ['white', 'pink', 'brown'] as NoiseColor[]) {
      const ch = channels[color];
      ch.gain.gain.cancelScheduledValues(now);
      ch.gain.gain.setValueAtTime(ch.gain.gain.value, now);
      ch.gain.gain.linearRampToValueAtTime(0, now + rampDuration);
    }
  }

  return {
    update(condition: WeatherCondition, now: number, rampDuration: number) {
      const config = getPrecipConfig(condition);

      if (config) {
        setAllBandpass(config.frequency, config.Q, now, rampDuration);
        // Fallback path always uses white noise (original behavior)
        crossfadeTo('white', config.gain, now, rampDuration);
      } else {
        // No precipitation: fade all to silence
        silenceAll(now, rampDuration);
      }
    },

    applyProfile(precip: SoundscapeProfile['precipitation'], now: number, rampDuration: number) {
      if (!precip.active) {
        silenceAll(now, rampDuration);
        return;
      }

      // Set bandpass parameters on all channels
      setAllBandpass(precip.centerFrequency, precip.Q, now, rampDuration);

      // Crossfade to the correct noise color
      crossfadeTo(precip.noiseColor, precip.gain, now, rampDuration);
    },

    destroy() {
      for (const color of ['white', 'pink', 'brown'] as NoiseColor[]) {
        const ch = channels[color];
        try {
          ch.source.stop();
        } catch {
          // Already stopped
        }
        ch.source.disconnect();
        ch.bandpass.disconnect();
        ch.gain.disconnect();
      }
    },
  };
}
