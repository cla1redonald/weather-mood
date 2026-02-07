'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { NormalizedParams, WeatherCondition } from '@/types/weather';
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
}

/**
 * React hook that creates and manages the weather audio engine.
 * Connects NormalizedParams + WeatherCondition to the synthesizer.
 *
 * Audio auto-starts when startOnGesture() is called from a user gesture
 * (e.g., city selection click). This satisfies browser autoplay policy.
 */
export function useWeatherAudio(
  params: NormalizedParams | null,
  condition: WeatherCondition | null,
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

  // Track latest params
  const paramsRef = useRef<NormalizedParams | null>(null);
  const conditionRef = useRef<WeatherCondition | null>(null);

  // Update audio params when weather changes
  useEffect(() => {
    paramsRef.current = params;
    conditionRef.current = condition;
    if (!params || !condition || !engineRef.current || isMuted) return;
    engineRef.current.update(params, condition);
  }, [params, condition, isMuted]);

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
    engine.unmute();
    setIsMuted(false);
  }, []);

  return {
    mute,
    unmute,
    isMuted,
    startOnGesture,
  };
}
