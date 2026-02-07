'use client';

import { useRef, useCallback, useState, useEffect } from 'react';

interface FetchAllParams {
  city: string;
  condition: string;
  temperature: number;
  poem: string;
  soundDescription: string;
  voice?: string;
}

export interface UseElevenLabsAudioReturn {
  /** Trigger all 3 ElevenLabs fetches in parallel */
  fetchAll: (params: FetchAllParams) => void;
  /** Mute all ElevenLabs audio */
  mute: () => void;
  /** Unmute all ElevenLabs audio */
  unmute: () => void;
  /** Whether audio is currently muted */
  isMuted: boolean;
  /** Whether any stream is still loading */
  isLoading: boolean;
  /** Whether at least music has loaded and started playing */
  hasAudio: boolean;
}

// Volume targets for each layer
const MUSIC_VOLUME = 0.5;
const SFX_VOLUME = 0.3;
const NARRATION_VOLUME = 0.8;

// Fade durations in ms
const MUSIC_FADE_MS = 3000;
const SFX_FADE_MS = 2000;
const NARRATION_DELAY_MS = 2000; // Wait for music to establish

/**
 * Smoothly fade an HTMLAudioElement's volume from current to target over duration.
 */
function fadeVolume(
  audio: HTMLAudioElement,
  targetVolume: number,
  durationMs: number,
): void {
  const startVolume = audio.volume;
  const startTime = performance.now();
  const diff = targetVolume - startVolume;

  if (Math.abs(diff) < 0.01) {
    audio.volume = targetVolume;
    return;
  }

  function step() {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    // Ease out cubic for smooth fade
    const eased = 1 - Math.pow(1 - progress, 3);
    audio.volume = startVolume + diff * eased;
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

/**
 * React hook that manages all three ElevenLabs audio streams:
 * - Music (loops continuously)
 * - Sound effects (loops continuously)
 * - Narration (plays once)
 */
export function useElevenLabsAudio(): UseElevenLabsAudioReturn {
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const sfxRef = useRef<HTMLAudioElement | null>(null);
  const narrationRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const narrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);

  // Track blob URLs for cleanup
  const blobUrlsRef = useRef<string[]>([]);

  function cleanupBlobs() {
    for (const url of blobUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    blobUrlsRef.current = [];
  }

  function stopAll() {
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current.src = '';
    }
    if (sfxRef.current) {
      sfxRef.current.pause();
      sfxRef.current.src = '';
    }
    if (narrationRef.current) {
      narrationRef.current.pause();
      narrationRef.current.src = '';
    }
    if (narrationTimerRef.current) {
      clearTimeout(narrationTimerRef.current);
      narrationTimerRef.current = null;
    }
    cleanupBlobs();
    setHasAudio(false);
  }

  // Create audio elements on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    musicRef.current = new Audio();
    musicRef.current.loop = true;
    musicRef.current.volume = 0;

    sfxRef.current = new Audio();
    sfxRef.current.loop = true;
    sfxRef.current.volume = 0;

    narrationRef.current = new Audio();
    narrationRef.current.loop = false;
    narrationRef.current.volume = 0;

    return () => {
      stopAll();
      musicRef.current = null;
      sfxRef.current = null;
      narrationRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAll = useCallback((params: FetchAllParams) => {
    // Abort any in-flight requests
    if (abortRef.current) {
      abortRef.current.abort();
    }
    stopAll();

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setHasAudio(false);

    const currentMuted = isMuted;

    // Fetch music
    async function fetchMusic() {
      try {
        const res = await fetch('/api/music', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city: params.city,
            condition: params.condition,
            temperature: params.temperature,
            poem: params.poem,
            soundDescription: params.soundDescription,
          }),
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          console.error(`[ElevenLabs] Music API returned ${res.status}: ${errText}`);
          return;
        }

        // Verify we got audio, not an error JSON response
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const errData = await res.json().catch(() => ({}));
          console.error('[ElevenLabs] Music API returned JSON instead of audio:', errData);
          return;
        }

        const blob = await res.blob();
        if (controller.signal.aborted) return;

        const url = URL.createObjectURL(blob);
        blobUrlsRef.current.push(url);

        if (musicRef.current && !controller.signal.aborted) {
          musicRef.current.src = url;
          musicRef.current.volume = 0;
          try {
            await musicRef.current.play();
          } catch (playErr) {
            console.error('[ElevenLabs] Music play() failed:', playErr);
          }
          if (!currentMuted) {
            fadeVolume(musicRef.current, MUSIC_VOLUME, MUSIC_FADE_MS);
          }
          setHasAudio(true);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          console.error('[ElevenLabs] Music fetch failed:', err);
        }
      }
    }

    // Fetch SFX
    async function fetchSfx() {
      try {
        const res = await fetch('/api/sfx', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city: params.city,
            condition: params.condition,
            temperature: params.temperature,
          }),
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          console.error(`[ElevenLabs] SFX API returned ${res.status}: ${errText}`);
          return;
        }

        // Verify we got audio, not an error JSON response
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const errData = await res.json().catch(() => ({}));
          console.error('[ElevenLabs] SFX API returned JSON instead of audio:', errData);
          return;
        }

        const blob = await res.blob();
        if (controller.signal.aborted) return;

        const url = URL.createObjectURL(blob);
        blobUrlsRef.current.push(url);

        if (sfxRef.current && !controller.signal.aborted) {
          sfxRef.current.src = url;
          sfxRef.current.volume = 0;
          try {
            await sfxRef.current.play();
          } catch (playErr) {
            console.error('[ElevenLabs] SFX play() failed:', playErr);
          }
          if (!currentMuted) {
            fadeVolume(sfxRef.current, SFX_VOLUME, SFX_FADE_MS);
          }
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          console.error('[ElevenLabs] SFX fetch failed:', err);
        }
      }
    }

    // Fetch narration
    async function fetchNarration() {
      try {
        const res = await fetch('/api/narrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poem: params.poem,
            voice: params.voice,
          }),
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          console.error(`[ElevenLabs] Narration API returned ${res.status}: ${errText}`);
          return;
        }

        // Verify we got audio, not an error JSON response
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const errData = await res.json().catch(() => ({}));
          console.error('[ElevenLabs] Narration API returned JSON instead of audio:', errData);
          return;
        }

        const blob = await res.blob();
        if (controller.signal.aborted) return;

        if (blob.size === 0) {
          console.warn('[ElevenLabs] Narration response was empty (0 bytes)');
          return;
        }

        const url = URL.createObjectURL(blob);
        blobUrlsRef.current.push(url);

        if (narrationRef.current && !controller.signal.aborted) {
          narrationRef.current.src = url;
          narrationRef.current.volume = 0;

          // Listen for load errors on the audio element
          narrationRef.current.onerror = () => {
            console.error('[ElevenLabs] Narration audio element error:', narrationRef.current?.error);
          };

          // Delay narration to let music establish
          narrationTimerRef.current = setTimeout(async () => {
            if (controller.signal.aborted || !narrationRef.current) return;
            try {
              await narrationRef.current.play();
              if (!currentMuted) {
                fadeVolume(narrationRef.current!, NARRATION_VOLUME, 1000);
              }
            } catch (playErr) {
              console.warn(
                '[ElevenLabs] Narration play() failed (may be autoplay policy):',
                playErr,
              );
            }
          }, NARRATION_DELAY_MS);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') {
          console.error('[ElevenLabs] Narration fetch failed:', err);
        }
      }
    }

    // Launch all 3 in parallel
    Promise.allSettled([fetchMusic(), fetchSfx(), fetchNarration()]).then(() => {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMuted]);

  const mute = useCallback(() => {
    setIsMuted(true);
    if (musicRef.current) fadeVolume(musicRef.current, 0, 500);
    if (sfxRef.current) fadeVolume(sfxRef.current, 0, 500);
    if (narrationRef.current) fadeVolume(narrationRef.current, 0, 500);
  }, []);

  const unmute = useCallback(() => {
    setIsMuted(false);
    if (musicRef.current && musicRef.current.src) {
      musicRef.current.play().catch((e) => console.error('[ElevenLabs] Music resume failed:', e));
      fadeVolume(musicRef.current, MUSIC_VOLUME, 1000);
    }
    if (sfxRef.current && sfxRef.current.src) {
      sfxRef.current.play().catch((e) => console.error('[ElevenLabs] SFX resume failed:', e));
      fadeVolume(sfxRef.current, SFX_VOLUME, 1000);
    }
    if (narrationRef.current && narrationRef.current.src && !narrationRef.current.ended) {
      narrationRef.current.play().catch((e) => console.warn('[ElevenLabs] Narration resume failed:', e));
      fadeVolume(narrationRef.current, NARRATION_VOLUME, 500);
    }
  }, []);

  return {
    fetchAll,
    mute,
    unmute,
    isMuted,
    isLoading,
    hasAudio,
  };
}
