import { NormalizedParams, WeatherCondition } from '@/types/weather';
import type { SoundscapeProfile } from '@/types/mood';
import { createToneLayer, ToneLayer } from './tone';
import { createWindLayer, WindLayer } from './wind';
import { createHumidityFilter, HumidityFilter } from './humidity';
import { createPrecipitationLayer, PrecipitationLayer } from './precipitation';
import { createThunderLayer, ThunderLayer } from './thunder';

const RAMP_DURATION = 3; // seconds for parameter transitions
const MUTE_FADE = 0.5; // seconds for mute fade
const UNMUTE_FADE = 1; // seconds for unmute fade

export interface AudioEngine {
  /** Resume AudioContext (must be called from user gesture) */
  resume(): Promise<void>;
  /** Update all audio parameters from weather data (fallback path) */
  update(params: NormalizedParams, condition: WeatherCondition): void;
  /** Apply an AI-generated soundscape profile */
  applyProfile(profile: SoundscapeProfile): void;
  /** Mute audio with smooth fade */
  mute(): void;
  /** Unmute audio with smooth fade */
  unmute(): void;
  /** Whether audio is currently muted */
  isMuted(): boolean;
  /** Set master volume (0-1) for ducking when external audio plays */
  setMasterVolume(level: number): void;
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
  let thunderLayer: ThunderLayer | null = null;
  let muted = true;
  let destroyed = false;
  let volumeLevel = 1; // Master volume (0-1), ducked when external audio plays

  function ensureContext(): { ctx: AudioContext; masterGain: GainNode } {
    if (destroyed) throw new Error('AudioEngine has been destroyed');

    if (!ctx) {
      ctx = new AudioContext();
      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.connect(ctx.destination);

      // Build audio graph:
      // tone -> wind (LFO) -> humidity (filter) -> master
      // precip -> humidity (filter) -> master
      // thunder -> humidity (filter) -> master
      humidityFilter = createHumidityFilter(ctx, masterGain);
      windLayer = createWindLayer(ctx, humidityFilter.input);
      toneLayer = createToneLayer(ctx, windLayer.input);
      precipLayer = createPrecipitationLayer(ctx, humidityFilter.input);
      thunderLayer = createThunderLayer(ctx, humidityFilter.input);
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

    applyProfile(profile: SoundscapeProfile) {
      const { ctx } = ensureContext();
      const now = ctx.currentTime;

      toneLayer?.applyProfile(profile.tone, now, RAMP_DURATION);
      windLayer?.applyProfile(profile.wind, now, RAMP_DURATION);
      humidityFilter?.applyProfile(profile.filter, now, RAMP_DURATION);
      precipLayer?.applyProfile(profile.precipitation, now, RAMP_DURATION);
      thunderLayer?.applyProfile(profile.thunder);
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
      masterGain.gain.linearRampToValueAtTime(volumeLevel, now + UNMUTE_FADE);
    },

    isMuted() {
      return muted;
    },

    setMasterVolume(level: number) {
      volumeLevel = Math.max(0, Math.min(1, level));
      if (!ctx || !masterGain || muted) return;
      const now = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(volumeLevel, now + RAMP_DURATION);
    },

    destroy() {
      destroyed = true;
      toneLayer?.destroy();
      windLayer?.destroy();
      humidityFilter?.destroy();
      precipLayer?.destroy();
      thunderLayer?.destroy();
      toneLayer = null;
      windLayer = null;
      humidityFilter = null;
      precipLayer = null;
      thunderLayer = null;

      if (ctx) {
        ctx.close();
        ctx = null;
      }
      masterGain = null;
    },
  };
}
