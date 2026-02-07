/**
 * Precipitation layer: white noise through a bandpass filter for rain/snow.
 *
 * Rain: bandpass 1000-3000Hz, gain 0.1, steady
 * Snow: bandpass 2000-6000Hz, gain 0.03, very quiet
 * No precip: silence (gain 0)
 */

import type { WeatherCondition } from '@/types/weather';

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

export interface PrecipitationLayer {
  /** Update the precipitation layer based on weather condition */
  update(condition: WeatherCondition, now: number, rampDuration: number): void;
  /** Clean up all nodes */
  destroy(): void;
}

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, NOISE_BUFFER_SIZE, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < NOISE_BUFFER_SIZE; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function createPrecipitationLayer(
  ctx: AudioContext,
  destination: AudioNode,
): PrecipitationLayer {
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = createNoiseBuffer(ctx);
  noiseSource.loop = true;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.setValueAtTime(2000, ctx.currentTime);
  bandpass.Q.setValueAtTime(0.5, ctx.currentTime);

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, ctx.currentTime); // Start silent

  noiseSource.connect(bandpass);
  bandpass.connect(gainNode);
  gainNode.connect(destination);
  noiseSource.start(ctx.currentTime);

  return {
    update(condition: WeatherCondition, now: number, rampDuration: number) {
      const config = getPrecipConfig(condition);

      if (config) {
        bandpass.frequency.cancelScheduledValues(now);
        bandpass.frequency.setValueAtTime(bandpass.frequency.value, now);
        bandpass.frequency.linearRampToValueAtTime(
          config.frequency,
          now + rampDuration,
        );

        bandpass.Q.cancelScheduledValues(now);
        bandpass.Q.setValueAtTime(bandpass.Q.value, now);
        bandpass.Q.linearRampToValueAtTime(config.Q, now + rampDuration);

        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(config.gain, now + rampDuration);
      } else {
        // No precipitation: fade to silence
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + rampDuration);
      }
    },

    destroy() {
      try {
        noiseSource.stop();
      } catch {
        // Already stopped
      }
      noiseSource.disconnect();
      bandpass.disconnect();
      gainNode.disconnect();
    },
  };
}
