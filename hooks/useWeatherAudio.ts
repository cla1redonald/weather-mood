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
}

/**
 * React hook that creates and manages the weather audio engine.
 * Connects NormalizedParams + WeatherCondition to the synthesizer.
 *
 * Audio is muted by default and requires a user gesture to start
 * (handled by the unmute callback which resumes AudioContext).
 */
export function useWeatherAudio(
  params: NormalizedParams | null,
  condition: WeatherCondition | null,
): UseWeatherAudioReturn {
  const engineRef = useRef<AudioEngine | null>(null);
  const [isMuted, setIsMuted] = useState(true);

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

  // Update audio params when weather changes
  useEffect(() => {
    if (!params || !condition || !engineRef.current) return;
    engineRef.current.update(params, condition);
  }, [params, condition]);

  const mute = useCallback(() => {
    engineRef.current?.mute();
    setIsMuted(true);
  }, []);

  const unmute = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.resume().then(() => {
      engine.unmute();
      setIsMuted(false);
    });
  }, []);

  return {
    mute,
    unmute,
    isMuted,
  };
}
