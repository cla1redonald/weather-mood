import { NormalizedParams, WeatherCondition } from '@/types/weather';
import { createToneLayer, ToneLayer } from './tone';
import { createWindLayer, WindLayer } from './wind';
import { createHumidityFilter, HumidityFilter } from './humidity';
import { createPrecipitationLayer, PrecipitationLayer } from './precipitation';

const RAMP_DURATION = 3; // seconds for parameter transitions
const MUTE_FADE = 0.5; // seconds for mute fade
const UNMUTE_FADE = 1; // seconds for unmute fade

export interface AudioEngine {
  /** Resume AudioContext (must be called from user gesture) */
  resume(): Promise<void>;
  /** Update all audio parameters from weather data */
  update(params: NormalizedParams, condition: WeatherCondition): void;
  /** Mute audio with smooth fade */
  mute(): void;
  /** Unmute audio with smooth fade */
  unmute(): void;
  /** Whether audio is currently muted */
  isMuted(): boolean;
  /** Clean up all resources */
  destroy(): void;
}

export function createAudioEngine(): AudioEngine {
  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let toneLayer: ToneLayer | null = null;
  let windLayer: WindLayer | null = null;
  let humidityFilter: HumidityFilter | null = null;
  let precipLayer: PrecipitationLayer | null = null;
  let muted = true;
  let destroyed = false;

  function ensureContext(): { ctx: AudioContext; masterGain: GainNode } {
    if (destroyed) throw new Error('AudioEngine has been destroyed');

    if (!ctx) {
      ctx = new AudioContext();
      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.connect(ctx.destination);

      // Build audio graph: tone -> wind (LFO) -> humidity (filter) -> master
      humidityFilter = createHumidityFilter(ctx, masterGain);
      windLayer = createWindLayer(ctx, humidityFilter.input);
      toneLayer = createToneLayer(ctx, windLayer.input);
      precipLayer = createPrecipitationLayer(ctx, humidityFilter.input);
    }

    return { ctx: ctx!, masterGain: masterGain! };
  }

  return {
    async resume() {
      const { ctx } = ensureContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
    },

    update(params: NormalizedParams, condition: WeatherCondition) {
      const { ctx } = ensureContext();
      const now = ctx.currentTime;

      toneLayer?.update(params.temperature, now, RAMP_DURATION);
      windLayer?.update(params.windSpeed, now, RAMP_DURATION);
      humidityFilter?.update(params.humidity, now, RAMP_DURATION);
      precipLayer?.update(condition, now, RAMP_DURATION);
    },

    mute() {
      if (!ctx || !masterGain) return;
      muted = true;
      const now = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(0, now + MUTE_FADE);
    },

    unmute() {
      const { ctx, masterGain } = ensureContext();
      muted = false;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(1, now + UNMUTE_FADE);
    },

    isMuted() {
      return muted;
    },

    destroy() {
      destroyed = true;
      toneLayer?.destroy();
      windLayer?.destroy();
      humidityFilter?.destroy();
      precipLayer?.destroy();
      toneLayer = null;
      windLayer = null;
      humidityFilter = null;
      precipLayer = null;

      if (ctx) {
        ctx.close();
        ctx = null;
      }
      masterGain = null;
    },
  };
}
