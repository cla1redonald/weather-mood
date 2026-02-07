/**
 * Base tone layer: sine oscillator whose frequency maps to temperature.
 * Cold (0.0) = 80Hz drone, Hot (1.0) = 300Hz warmer tone.
 */

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
  /** Update the tone frequency based on temperature */
  update(temperature: number, now: number, rampDuration: number): void;
  /** Clean up all nodes */
  destroy(): void;
}

export function createToneLayer(
  ctx: AudioContext,
  destination: AudioNode,
): ToneLayer {
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(temperatureToFrequency(0.5), ctx.currentTime);
  gainNode.gain.setValueAtTime(TONE_GAIN, ctx.currentTime);

  oscillator.connect(gainNode);
  gainNode.connect(destination);
  oscillator.start(ctx.currentTime);

  return {
    input: gainNode,

    update(temperature: number, now: number, rampDuration: number) {
      const freq = temperatureToFrequency(temperature);
      oscillator.frequency.cancelScheduledValues(now);
      oscillator.frequency.setValueAtTime(oscillator.frequency.value, now);
      oscillator.frequency.linearRampToValueAtTime(freq, now + rampDuration);
    },

    destroy() {
      try {
        oscillator.stop();
      } catch {
        // Already stopped
      }
      oscillator.disconnect();
      gainNode.disconnect();
    },
  };
}
