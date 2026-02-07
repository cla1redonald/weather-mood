'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { NormalizedParams, WeatherCondition } from '@/types/weather';
import type { SoundscapeProfile } from '@/types/mood';
import { createAudioEngine, type AudioEngine } from '@/lib/audio';

interface UseWeatherAudioReturn {
  /** Mute audio with smooth fade */
  mute: () => void;
  /** Unmute audio (resumes AudioContext on first call) */
  unmute: () => void;
  /** Whether audio is currently muted */
  isMuted: boolean;
  /** Start audio on user gesture (call from click handler) */
  startOnGesture: () => void;
  /** Set master volume (0-1) for ducking when ElevenLabs audio plays */
  setVolume: (level: number) => void;
}

/**
 * React hook that creates and manages the weather audio engine.
 * Connects NormalizedParams + WeatherCondition to the synthesizer.
 * When a SoundscapeProfile is provided, it overrides the parametric defaults.
 *
 * Audio auto-starts when startOnGesture() is called from a user gesture
 * (e.g., city selection click). This satisfies browser autoplay policy.
 */
export function useWeatherAudio(
  params: NormalizedParams | null,
  condition: WeatherCondition | null,
  soundProfile?: SoundscapeProfile | null,
): UseWeatherAudioReturn {
  const engineRef = useRef<AudioEngine | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const hasStartedRef = useRef(false);

  // Create engine on mount, destroy on unmount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const engine = createAudioEngine();
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Track latest params and profile
  const paramsRef = useRef<NormalizedParams | null>(null);
  const conditionRef = useRef<WeatherCondition | null>(null);
  const profileRef = useRef<SoundscapeProfile | null>(null);

  // Update audio params when weather changes
  useEffect(() => {
    paramsRef.current = params;
    conditionRef.current = condition;
    if (!params || !condition || !engineRef.current || isMuted) return;
    engineRef.current.update(params, condition);
  }, [params, condition, isMuted]);

  // Apply AI sound profile when it arrives (overrides parametric defaults)
  useEffect(() => {
    profileRef.current = soundProfile ?? null;
    if (!soundProfile || !engineRef.current || isMuted) return;
    engineRef.current.applyProfile(soundProfile);
  }, [soundProfile, isMuted]);

  // Auto-start audio from a user gesture (city click)
  const startOnGesture = useCallback(async () => {
    if (hasStartedRef.current) return;
    const engine = engineRef.current;
    if (!engine) return;
    hasStartedRef.current = true;
    await engine.resume();
    if (paramsRef.current && conditionRef.current) {
      engine.update(paramsRef.current, conditionRef.current);
    }
    if (profileRef.current) {
      engine.applyProfile(profileRef.current);
    }
    engine.unmute();
    setIsMuted(false);
  }, []);

  const mute = useCallback(() => {
    engineRef.current?.mute();
    setIsMuted(true);
  }, []);

  const unmute = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    await engine.resume();
    if (paramsRef.current && conditionRef.current) {
      engine.update(paramsRef.current, conditionRef.current);
    }
    if (profileRef.current) {
      engine.applyProfile(profileRef.current);
    }
    engine.unmute();
    setIsMuted(false);
  }, []);

  // Duck/restore synth volume (0-1) when ElevenLabs audio plays
  const volumeRef = useRef(1);
  const setVolume = useCallback((level: number) => {
    volumeRef.current = level;
    const engine = engineRef.current;
    if (!engine || isMuted) return;
    engine.setMasterVolume(level);
  }, [isMuted]);

  return {
    mute,
    unmute,
    isMuted,
    startOnGesture,
    setVolume,
  };
}
