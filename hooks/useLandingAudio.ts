'use client';

import { useRef, useCallback, useState, useEffect } from 'react';

const LANDING_VOLUME = 0.25;
const FADE_IN_MS = 2000;
const FADE_OUT_MS = 1500;

/**
 * Smoothly fade an HTMLAudioElement's volume (ease-out cubic).
 */
function fadeVolume(audio: HTMLAudioElement, target: number, durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    const startVolume = audio.volume;
    const startTime = performance.now();
    const diff = target - startVolume;

    if (Math.abs(diff) < 0.01) {
      audio.volume = target;
      resolve();
      return;
    }

    function step() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      audio.volume = startVolume + diff * eased;
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}

export interface UseLandingAudioReturn {
  startAudio: () => void;
  fadeOut: () => Promise<void>;
}

export function useLandingAudio(): UseLandingAudioReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);

  // Create audio element on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = new Audio('/audio/ambient-landing.mp3');
    audio.loop = true;
    audio.volume = 0;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  const startAudio = useCallback(() => {
    if (startedRef.current || !audioRef.current) return;
    startedRef.current = true;

    const audio = audioRef.current;
    audio.play()
      .then(() => {
        fadeVolume(audio, LANDING_VOLUME, FADE_IN_MS);
      })
      .catch(() => {
        // Autoplay blocked — will retry on next gesture
        startedRef.current = false;
      });
  }, []);

  // Use audio.paused (ref) instead of state to avoid closure staleness
  const fadeOut = useCallback((): Promise<void> => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return Promise.resolve();

    return fadeVolume(audio, 0, FADE_OUT_MS).then(() => {
      audio.pause();
      audio.src = '';
    });
  }, []);

  return { startAudio, fadeOut };
}
