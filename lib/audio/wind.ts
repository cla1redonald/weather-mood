/**
 * Wind layer: LFO (low-frequency oscillator) modulating the amplitude of the
 * base tone to create a wobble/tremolo effect.
 *
 * Calm (0.0) = barely perceptible wobble (0.5Hz, depth 0.05)
 * Gale (1.0) = rapid tremolo (4Hz, depth 0.4)
 */

const MIN_RATE = 0.5; // Hz
const MAX_RATE = 4; // Hz
const MIN_DEPTH = 0.05;
const MAX_DEPTH = 0.4;

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
  /** Update LFO rate and depth based on wind speed */
  update(windSpeed: number, now: number, rampDuration: number): void;
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

  return {
    input: modulatedGain,

    update(windSpeed: number, now: number, rampDuration: number) {
      const rate = windToLfoRate(windSpeed);
      const depth = windToLfoDepth(windSpeed);

      lfo.frequency.cancelScheduledValues(now);
      lfo.frequency.setValueAtTime(lfo.frequency.value, now);
      lfo.frequency.linearRampToValueAtTime(rate, now + rampDuration);

      lfoGain.gain.cancelScheduledValues(now);
      lfoGain.gain.setValueAtTime(lfoGain.gain.value, now);
      lfoGain.gain.linearRampToValueAtTime(depth, now + rampDuration);
    },

    destroy() {
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
