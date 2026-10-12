'use client';

/**
 * Runs the self-critique loop after the first render and exposes the ticker
 * state. Apply goes through the page's visual profile state, so every
 * revision reaches the canvas via renderer.update() and its 2 s crossfade.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { VisualProfile } from '@/types/mood';
import type { MoodInput } from '@/lib/poem';
import { captureCanvasFrame } from '@/lib/critique/capture';
import { MAX_CRITIQUE_ROUNDS } from '@/lib/critique/limits';
import { runCritiqueLoop, SKIP_REASON, type LoopResult } from '@/lib/critique/loop';

export interface CritiqueTickerState {
  phase: 'idle' | 'running' | 'done';
  /** The round in progress, or the last one completed once done. */
  round: number;
  roundsCompleted: number;
  maxRounds: number;
  /** "Round 2 of 3: ..." */
  message: string;
  /** Closing line once the loop has stopped. */
  note: string | null;
}

export interface StartCritiqueArgs {
  profile: VisualProfile;
  weather: MoodInput;
  visitToken: string | null | undefined;
  getCanvas: () => HTMLCanvasElement | null;
}

export interface UseSelfCritiqueOptions {
  /** Injected in tests; defaults to screenshotting getCanvas(). */
  capture?: (canvas: HTMLCanvasElement | null, signal: AbortSignal) => Promise<string>;
  fetchImpl?: typeof fetch;
  /** How long the closing note stays up. */
  noteMs?: number;
}

const IDLE: CritiqueTickerState = {
  phase: 'idle', round: 0, roundsCompleted: 0, maxRounds: MAX_CRITIQUE_ROUNDS, message: '', note: null,
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

async function defaultCapture(canvas: HTMLCanvasElement | null, signal: AbortSignal): Promise<string> {
  if (!canvas) throw new Error('No canvas to capture');
  return captureCanvasFrame(canvas, { signal });
}

function keptPhrase(result: LoopResult): string {
  if (!result.rolledBack || result.keptRound === null) return '';
  return result.keptRound === 1
    ? ' Went back to the first draft, which scored highest.'
    : ` Went back to the round ${result.keptRound - 1} revision, which scored highest.`;
}

export function closingNote(result: LoopResult): string | null {
  const rounds = `${result.roundsCompleted} ${result.roundsCompleted === 1 ? 'round' : 'rounds'}`;
  switch (result.stop) {
    case 'accepted':
      return `Every score reached 4 out of 5 after ${rounds}.`;
    case 'round_cap':
      return `Done after ${rounds}.${keptPhrase(result)}`;
    case 'budget':
      return `Out of time after ${rounds}.${keptPhrase(result)}`;
    case 'stalled':
      return 'No further changes suggested.';
    case 'error':
      return `The critic is unavailable, keeping this version.${keptPhrase(result)}`;
    default:
      return null;
  }
}

export function useSelfCritique(apply: (profile: VisualProfile) => void, options: UseSelfCritiqueOptions = {}) {
  const [state, setState] = useState<CritiqueTickerState>(IDLE);
  const controllerRef = useRef<AbortController | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyRef = useRef(apply);
  const optionsRef = useRef(options);

  useEffect(() => {
    applyRef.current = apply;
    optionsRef.current = options;
  });

  const clearHideTimer = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
  };

  const cancel = useCallback(() => {
    controllerRef.current?.abort('city-changed');
    controllerRef.current = null;
    clearHideTimer();
    setState(IDLE);
  }, []);

  const skip = useCallback(() => {
    controllerRef.current?.abort(SKIP_REASON);
    controllerRef.current = null;
    clearHideTimer();
    setState(IDLE);
  }, []);

  const start = useCallback(({ profile, weather, visitToken, getCanvas }: StartCritiqueArgs) => {
    controllerRef.current?.abort('superseded');
    controllerRef.current = null;
    clearHideTimer();

    // Watching the canvas redraw itself is motion; respect the preference.
    if (prefersReducedMotion() || !visitToken) {
      setState(IDLE);
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    const { capture = defaultCapture, fetchImpl, noteMs = 8_000 } = optionsRef.current;

    setState({
      ...IDLE,
      phase: 'running',
      round: 1,
      message: `Round 1 of ${MAX_CRITIQUE_ROUNDS}: Claude is looking at its own work`,
    });

    void runCritiqueLoop({
      initialProfile: profile,
      weather,
      visitToken,
      capture: (signal) => capture(getCanvas(), signal),
      apply: (next) => applyRef.current(next),
      signal: controller.signal,
      fetchImpl,
      // Later rounds keep the previous critique on screen while the next
      // screenshot settles; only the round counter moves.
      onRoundStart: (round) => setState((s) => (s.phase === 'running' ? { ...s, round } : s)),
      onRound: (event) => setState((s) => ({
        ...s,
        round: event.round,
        roundsCompleted: event.round,
        message: `Round ${event.round} of ${event.maxRounds}: ${event.critique}`,
      })),
    }).then((result) => {
      if (controllerRef.current !== controller) return; // cancelled, skipped or superseded
      controllerRef.current = null;
      const note = closingNote(result);
      if (!note) {
        setState(IDLE);
        return;
      }
      setState((s) => ({ ...s, phase: 'done', roundsCompleted: result.roundsCompleted, note }));
      hideTimerRef.current = setTimeout(() => setState(IDLE), noteMs);
    });
  }, []);

  useEffect(() => () => {
    controllerRef.current?.abort('unmount');
    clearHideTimer();
  }, []);

  return { state, start, skip, cancel };
}
