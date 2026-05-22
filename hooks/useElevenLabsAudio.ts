'use client';

import { useRef, useCallback, useState, useEffect } from 'react';

interface FetchAllParams {
  poem: string;
  poemLocal?: string;
  voice?: string;
  languageCode?: string;
  musicDirection: string;
  ambienceDirection: string;
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
const MUSIC_DUCKED_VOLUME = 0.12; // Quiet bed under narration
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
 * Check if the browser supports MediaSource Extensions for audio/mpeg streaming.
 */
function canUseMediaSource(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaSource !== 'undefined' &&
    MediaSource.isTypeSupported('audio/mpeg')
  );
}

/**
 * Stream audio progressively using MediaSource API.
 * Starts playback after the first chunk arrives rather than waiting for the full download.
 *
 * @param audio - The HTMLAudioElement to play into
 * @param response - The fetch Response with a readable body stream
 * @param signal - AbortSignal to cancel streaming
 * @param onPlaybackStarted - Callback fired when playback actually begins
 * @param blobUrls - Array to push the MediaSource object URL into for cleanup
 * @returns Promise that resolves when streaming is complete
 */
async function playProgressively(
  audio: HTMLAudioElement,
  response: Response,
  signal: AbortSignal,
  onPlaybackStarted: () => void,
  blobUrls: string[],
): Promise<void> {
  const mediaSource = new MediaSource();
  const objectUrl = URL.createObjectURL(mediaSource);
  blobUrls.push(objectUrl);
  audio.src = objectUrl;

  return new Promise<void>((resolve, reject) => {
    mediaSource.addEventListener(
      'sourceopen',
      () => {
        let sourceBuffer: SourceBuffer;
        try {
          sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
        } catch (err) {
          console.error('[ElevenLabs] Failed to create SourceBuffer:', err);
          reject(err);
          return;
        }

        const reader = response.body!.getReader();
        const queue: Uint8Array[] = [];
        let playbackStarted = false;
        let streamDone = false;

        function appendNext() {
          if (
            queue.length > 0 &&
            !sourceBuffer.updating &&
            mediaSource.readyState === 'open'
          ) {
            try {
              const chunk = queue.shift()!;
              // Create a new ArrayBuffer copy to satisfy TypeScript's BufferSource type
              const buffer = new ArrayBuffer(chunk.byteLength);
              new Uint8Array(buffer).set(chunk);
              sourceBuffer.appendBuffer(buffer);
            } catch (err) {
              console.error('[ElevenLabs] SourceBuffer append error:', err);
              // Don't reject here — the stream may still be usable
            }
          } else if (
            queue.length === 0 &&
            streamDone &&
            !sourceBuffer.updating &&
            mediaSource.readyState === 'open'
          ) {
            try {
              mediaSource.endOfStream();
            } catch (err) {
              // endOfStream can throw if the source is already ended
              console.warn('[ElevenLabs] endOfStream warning:', err);
            }
            resolve();
          }
        }

        sourceBuffer.addEventListener('updateend', () => {
          // Start playback after first chunk is buffered
          if (!playbackStarted && audio.buffered.length > 0) {
            playbackStarted = true;
            audio.volume = 0;
            audio
              .play()
              .then(onPlaybackStarted)
              .catch((err) => {
                console.error(
                  '[ElevenLabs] Progressive play() failed:',
                  err,
                );
              });
          }
          appendNext();
        });

        // Read the stream
        async function readStream() {
          try {
            while (true) {
              if (signal.aborted) {
                reader.cancel();
                resolve();
                return;
              }
              const { done, value } = await reader.read();
              if (done) {
                streamDone = true;
                appendNext(); // Trigger endOfStream check
                return;
              }
              queue.push(value);
              appendNext();
            }
          } catch (err: unknown) {
            if ((err as Error)?.name !== 'AbortError') {
              console.error('[ElevenLabs] Stream read error:', err);
              reject(err);
            } else {
              resolve();
            }
          }
        }

        readStream();
      },
      { once: true },
    );

    // Handle MediaSource errors
    mediaSource.addEventListener(
      'error',
      () => {
        console.error('[ElevenLabs] MediaSource error event');
        reject(new Error('MediaSource error'));
      },
      { once: true },
    );
  });
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
  const isMutedRef = useRef(true); // Ref stays current across async closures
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

  /** Immediately pause, clear sources, revoke blobs, clear timers, reset state. */
  function cleanupAudioRefs() {
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

  /** Fade out all active audio over STOP_FADE_MS, then clean up. Resolves when done. */
  function stopAll(): Promise<void> {
    const STOP_FADE_MS = 400;
    const hasPlaying =
      (musicRef.current && !musicRef.current.paused) ||
      (sfxRef.current && !sfxRef.current.paused) ||
      (narrationRef.current && !narrationRef.current.paused);

    if (!hasPlaying) {
      cleanupAudioRefs();
      return Promise.resolve();
    }

    // Fade all active elements to 0
    if (musicRef.current && !musicRef.current.paused) {
      fadeVolume(musicRef.current, 0, STOP_FADE_MS);
    }
    if (sfxRef.current && !sfxRef.current.paused) {
      fadeVolume(sfxRef.current, 0, STOP_FADE_MS);
    }
    if (narrationRef.current && !narrationRef.current.paused) {
      fadeVolume(narrationRef.current, 0, STOP_FADE_MS);
    }

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        cleanupAudioRefs();
        resolve();
      }, STOP_FADE_MS);
    });
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
      cleanupAudioRefs();
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

    // Overlap: fade old audio while starting new fetches in parallel
    const startFetches = async () => {
      const STOP_FADE_MS = 400;

      // Save refs to old audio elements for fade-out
      const oldMusic = musicRef.current;
      const oldSfx = sfxRef.current;
      const oldNarration = narrationRef.current;
      const oldBlobUrls = [...blobUrlsRef.current];

      // Clear narration timer
      if (narrationTimerRef.current) {
        clearTimeout(narrationTimerRef.current);
        narrationTimerRef.current = null;
      }

      // Fire-and-forget fade-out on old elements
      if (oldMusic && !oldMusic.paused) fadeVolume(oldMusic, 0, STOP_FADE_MS);
      if (oldSfx && !oldSfx.paused) fadeVolume(oldSfx, 0, STOP_FADE_MS);
      if (oldNarration && !oldNarration.paused) fadeVolume(oldNarration, 0, STOP_FADE_MS);

      // Schedule cleanup of old elements after fade completes
      setTimeout(() => {
        oldMusic?.pause(); if (oldMusic) oldMusic.src = '';
        oldSfx?.pause(); if (oldSfx) oldSfx.src = '';
        oldNarration?.pause(); if (oldNarration) oldNarration.src = '';
        oldBlobUrls.forEach(url => URL.revokeObjectURL(url));
      }, STOP_FADE_MS);

      // Create fresh audio elements for new city immediately
      musicRef.current = new Audio();
      musicRef.current.loop = true;
      musicRef.current.volume = 0;

      sfxRef.current = new Audio();
      sfxRef.current.loop = true;
      sfxRef.current.volume = 0;

      narrationRef.current = new Audio();
      narrationRef.current.loop = false;
      narrationRef.current.volume = 0;

      blobUrlsRef.current = [];

      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);
      setHasAudio(false);

      // Auto-unmute — calling fetchAll means the user wants audio
      isMutedRef.current = false;
      setIsMuted(false);
      const currentMuted = false;

      const useProgressive = canUseMediaSource();

      // Fetch music
      async function fetchMusic() {
        try {
          const res = await fetch('/api/music', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              musicDirection: params.musicDirection,
              poem: params.poem,
            }),
            signal: controller.signal,
          });

          if (controller.signal.aborted) return;

          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            console.error(
              `[ElevenLabs] Music API returned ${res.status}: ${errText}`,
            );
            return;
          }

          // Verify we got audio, not an error JSON response
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errData = await res.json().catch(() => ({}));
            console.error(
              '[ElevenLabs] Music API returned JSON instead of audio:',
              errData,
            );
            return;
          }

          if (!musicRef.current || controller.signal.aborted) return;

          // Progressive playback: stream audio via MediaSource
          if (useProgressive && res.body) {
            try {
              musicRef.current.loop = true;
              await playProgressively(
                musicRef.current,
                res,
                controller.signal,
                () => {
                  // Playback started — fade in and signal hasAudio
                  if (!currentMuted && musicRef.current) {
                    fadeVolume(musicRef.current, MUSIC_VOLUME, MUSIC_FADE_MS);
                  }
                  setHasAudio(true);
                },
                blobUrlsRef.current,
              );
              return;
            } catch (err) {
              // MediaSource failed — fall through to blob approach
              console.warn(
                '[ElevenLabs] Progressive playback failed, falling back to blob:',
                err,
              );
              // Reset audio element for blob fallback
              if (musicRef.current) {
                musicRef.current.pause();
                musicRef.current.src = '';
              }
            }
          }

          // Blob fallback (or primary path when MediaSource unavailable)
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
              ambienceDirection: params.ambienceDirection,
            }),
            signal: controller.signal,
          });

          if (controller.signal.aborted) return;

          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            console.warn(
              `[ElevenLabs] SFX unavailable (${res.status}) — music and narration still playing`,
            );
            if (errText) console.debug('[ElevenLabs] SFX detail:', errText);
            return;
          }

          // Verify we got audio, not an error JSON response
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            console.warn('[ElevenLabs] SFX unavailable — music and narration still playing');
            return;
          }

          if (!sfxRef.current || controller.signal.aborted) return;

          // Progressive playback: stream audio via MediaSource
          if (useProgressive && res.body) {
            try {
              sfxRef.current.loop = true;
              await playProgressively(
                sfxRef.current,
                res,
                controller.signal,
                () => {
                  // Playback started — fade in
                  if (!currentMuted && sfxRef.current) {
                    fadeVolume(sfxRef.current, SFX_VOLUME, SFX_FADE_MS);
                  }
                },
                blobUrlsRef.current,
              );
              return;
            } catch (err) {
              // MediaSource failed — fall through to blob approach
              console.warn(
                '[ElevenLabs] Progressive SFX playback failed, falling back to blob:',
                err,
              );
              // Reset audio element for blob fallback
              if (sfxRef.current) {
                sfxRef.current.pause();
                sfxRef.current.src = '';
              }
            }
          }

          // Blob fallback (or primary path when MediaSource unavailable)
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
            console.warn('[ElevenLabs] SFX unavailable — music and narration still playing');
          }
        }
      }

      // Fetch narration (always uses blob — short audio, often cached)
      async function fetchNarration() {
        try {
          const res = await fetch('/api/narrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              poem: params.poem,           // English fallback for unsupported languages
              poemLocal: params.poemLocal, // Local-language version (used when supported)
              voice: params.voice,
              languageCode: params.languageCode,
            }),
            signal: controller.signal,
          });

          if (controller.signal.aborted) return;

          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            console.error(
              `[ElevenLabs] Narration API returned ${res.status}: ${errText}`,
            );
            return;
          }

          // Verify we got audio, not an error JSON response
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errData = await res.json().catch(() => ({}));
            console.error(
              '[ElevenLabs] Narration API returned JSON instead of audio:',
              errData,
            );
            return;
          }

          const blob = await res.blob();
          if (controller.signal.aborted) return;

          if (blob.size === 0) {
            console.warn(
              '[ElevenLabs] Narration response was empty (0 bytes)',
            );
            return;
          }

          const url = URL.createObjectURL(blob);
          blobUrlsRef.current.push(url);

          if (narrationRef.current && !controller.signal.aborted) {
            narrationRef.current.src = url;
            narrationRef.current.volume = 0;

            // Listen for load errors on the audio element
            narrationRef.current.onerror = () => {
              console.error(
                '[ElevenLabs] Narration audio element error:',
                narrationRef.current?.error,
              );
            };

            // Restore music volume when narration finishes
            narrationRef.current.onended = () => {
              if (musicRef.current && !isMutedRef.current) {
                fadeVolume(musicRef.current, MUSIC_VOLUME, 2000);
              }
            };

            // Delay narration to let music establish
            narrationTimerRef.current = setTimeout(async () => {
              if (controller.signal.aborted || !narrationRef.current) return;
              try {
                await narrationRef.current.play();
                if (!currentMuted) {
                  // Duck music under the voice
                  if (musicRef.current) {
                    fadeVolume(musicRef.current, MUSIC_DUCKED_VOLUME, 1500);
                  }
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
      Promise.allSettled([fetchMusic(), fetchSfx(), fetchNarration()]).then(
        () => {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        },
      );
    }; // end startFetches

    startFetches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mute = useCallback(() => {
    setIsMuted(true);
    isMutedRef.current = true;
    if (musicRef.current) fadeVolume(musicRef.current, 0, 500);
    if (sfxRef.current) fadeVolume(sfxRef.current, 0, 500);
    if (narrationRef.current) fadeVolume(narrationRef.current, 0, 500);
  }, []);

  const unmute = useCallback(() => {
    // No-op if already unmuted — prevents replaying old narration on city switch
    if (!isMutedRef.current) return;

    setIsMuted(false);
    isMutedRef.current = false;

    const narrationPlaying =
      narrationRef.current?.src &&
      !narrationRef.current.ended &&
      !narrationRef.current.paused;
    const narrationWillReplay =
      narrationRef.current?.src && narrationRef.current.ended;

    // Music volume depends on whether narration is active
    const musicTarget =
      narrationPlaying || narrationWillReplay
        ? MUSIC_DUCKED_VOLUME
        : MUSIC_VOLUME;

    if (musicRef.current && musicRef.current.src) {
      musicRef.current
        .play()
        .catch((e) =>
          console.error('[ElevenLabs] Music resume failed:', e),
        );
      fadeVolume(musicRef.current, musicTarget, 1000);
    }
    if (sfxRef.current && sfxRef.current.src) {
      sfxRef.current
        .play()
        .catch((e) => console.error('[ElevenLabs] SFX resume failed:', e));
      fadeVolume(sfxRef.current, SFX_VOLUME, 1000);
    }
    if (narrationRef.current && narrationRef.current.src) {
      // If narration already finished playing silently, replay from start
      if (narrationRef.current.ended) {
        narrationRef.current.currentTime = 0;
      }
      narrationRef.current
        .play()
        .catch((e) =>
          console.warn('[ElevenLabs] Narration resume failed:', e),
        );
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
