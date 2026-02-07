/**
 * Humidity filter layer: a low-pass filter on the output chain.
 *
 * Dry (0.0) = high cutoff (4000Hz, crisp/bright)
 * Humid (1.0) = low cutoff (800Hz, muffled/warm)
 * Q (resonance) fixed at 1.0 (subtle)
 */

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
  /** Update filter cutoff based on humidity */
  update(humidity: number, now: number, rampDuration: number): void;
  /** Clean up all nodes */
  destroy(): void;
}

export function createHumidityFilter(
  ctx: AudioContext,
  destination: AudioNode,
): HumidityFilter {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(humidityToCutoff(0.5), ctx.currentTime);
  filter.Q.setValueAtTime(FILTER_Q, ctx.currentTime);
  filter.connect(destination);

  return {
    input: filter,

    update(humidity: number, now: number, rampDuration: number) {
      const cutoff = humidityToCutoff(humidity);
      filter.frequency.cancelScheduledValues(now);
      filter.frequency.setValueAtTime(filter.frequency.value, now);
      filter.frequency.linearRampToValueAtTime(cutoff, now + rampDuration);
    },

    destroy() {
      filter.disconnect();
    },
  };
}
