/**
 * The self-critique loop that runs in the browser after the first render.
 *
 * Each round screenshots what is on screen, asks /api/critique to score it,
 * and shows the revision through the renderer's crossfade. It stops on an
 * accept, at the round cap, when the wall-clock budget runs out, when the
 * critic stops suggesting changes, or when it is aborted (a new city, the
 * Skip button, unmount).
 *
 * A round scores the version currently on screen, so the revision a round
 * produces is only scored by the next one. The loop never ends on a version
 * nobody has scored: at the cap, the final round's revision is not applied, and
 * if the version on screen scored lower than an earlier one, it rolls back
 * to the best.
 */
import type { VisualProfile } from '@/types/mood';
import type { MoodInput } from '@/lib/poem';
import type { CritiqueResponse } from '@/lib/critique/types';
import type { Verdict } from '@/lib/critique/verdict';
import { CRITIQUE_BUDGET_MS, CRITIQUE_ROUND_TIMEOUT_MS, MAX_CRITIQUE_ROUNDS } from '@/lib/critique/limits';

/**
 * A signal that fires when `parent` fires or after `ms`, whichever is first,
 * so one slow critique cannot hold the loop open indefinitely.
 */
function withRoundTimeout(parent: AbortSignal, ms: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('round-timeout'), ms);
  const forward = () => {
    clearTimeout(timer);
    controller.abort(parent.reason);
  };
  if (parent.aborted) forward();
  else parent.addEventListener('abort', forward, { once: true });
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return controller.signal;
}

export type LoopStop = 'accepted' | 'round_cap' | 'budget' | 'stalled' | 'error' | 'skipped' | 'aborted';

/** Abort reasons the loop understands. Anything else counts as 'aborted'. */
export const SKIP_REASON = 'skip';
const BUDGET_REASON = 'budget';

export interface RoundEvent {
  round: number;
  maxRounds: number;
  verdict: Verdict;
  critique: string;
  score: number;
}

export interface LoopResult {
  stop: LoopStop;
  roundsCompleted: number;
  finalProfile: VisualProfile;
  /** Round whose critique scored the kept version: 1 means the first draft. */
  keptRound: number | null;
  rolledBack: boolean;
}

export interface LoopOptions {
  initialProfile: VisualProfile;
  weather: MoodInput;
  visitToken: string;
  /** Screenshot the canvas; should honour the signal. */
  capture: (signal: AbortSignal) => Promise<string>;
  /** Show a profile on the canvas (via renderer.update and its crossfade). */
  apply: (profile: VisualProfile) => void;
  signal: AbortSignal;
  onRoundStart?: (round: number, maxRounds: number) => void;
  onRound?: (event: RoundEvent) => void;
  fetchImpl?: typeof fetch;
  maxRounds?: number;
  budgetMs?: number;
  /** Abandon a single critique request after this long. */
  roundTimeoutMs?: number;
  now?: () => number;
}

/**
 * One number per scored version, used to pick the best. A version that
 * failed the pixel checks scores zero whatever the model said, so a black
 * frame the model liked can never be the one we roll back to.
 */
export function effectiveScore(response: CritiqueResponse): number {
  if (response.forcedBy.length > 0) return 0;
  return response.total ?? 0;
}

interface Version {
  profile: VisualProfile;
  /** The round that scored this version, or null if not yet scored. */
  scoredInRound: number | null;
  score: number | null;
}

export async function runCritiqueLoop(options: LoopOptions): Promise<LoopResult> {
  const {
    initialProfile, weather, visitToken, capture, apply, signal, onRoundStart, onRound,
    fetchImpl = fetch, maxRounds = MAX_CRITIQUE_ROUNDS, budgetMs = CRITIQUE_BUDGET_MS,
    roundTimeoutMs = CRITIQUE_ROUND_TIMEOUT_MS, now = Date.now,
  } = options;

  const internal = new AbortController();
  const forwardAbort = () => internal.abort(signal.reason);
  if (signal.aborted) forwardAbort();
  else signal.addEventListener('abort', forwardAbort, { once: true });
  const budgetTimer = setTimeout(() => internal.abort(BUDGET_REASON), budgetMs);
  const started = now();

  let shown: Version = { profile: initialProfile, scoredInRound: null, score: null };
  let best: Version | null = null;
  let roundsCompleted = 0;

  const stopFromAbort = (): LoopStop => {
    const reason = internal.signal.reason;
    if (reason === SKIP_REASON) return 'skipped';
    if (reason === BUDGET_REASON) return 'budget';
    return 'aborted';
  };

  const finish = (stop: LoopStop): LoopResult => {
    clearTimeout(budgetTimer);
    signal.removeEventListener('abort', forwardAbort);

    // A new city or an unmount: leave the canvas alone, it is no longer ours.
    // Skip: the viewer asked for the motion to stop, so nothing changes.
    if (stop === 'aborted' || stop === 'skipped' || stop === 'accepted' || !best) {
      return { stop, roundsCompleted, finalProfile: shown.profile, keptRound: shown.scoredInRound, rolledBack: false };
    }

    const shownIsBest = shown.score !== null && shown.score >= best.score!;
    if (shownIsBest) {
      return { stop, roundsCompleted, finalProfile: shown.profile, keptRound: shown.scoredInRound, rolledBack: false };
    }
    apply(best.profile);
    return { stop, roundsCompleted, finalProfile: best.profile, keptRound: best.scoredInRound, rolledBack: true };
  };

  for (let round = 1; round <= maxRounds; round++) {
    if (internal.signal.aborted) return finish(stopFromAbort());
    if (now() - started >= budgetMs) return finish('budget');
    onRoundStart?.(round, maxRounds);

    let data: CritiqueResponse;
    try {
      const image = await capture(internal.signal);
      const response = await fetchImpl('/api/critique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-visit-token': visitToken },
        body: JSON.stringify({ image, profile: shown.profile, weather, round }),
        signal: withRoundTimeout(internal.signal, roundTimeoutMs),
      });
      if (internal.signal.aborted) return finish(stopFromAbort());
      if (response.status === 429) return finish('round_cap');
      if (!response.ok) return finish('error');
      data = (await response.json()) as CritiqueResponse;
    } catch {
      return finish(internal.signal.aborted ? stopFromAbort() : 'error');
    }
    if (internal.signal.aborted) return finish(stopFromAbort());

    roundsCompleted = round;
    const score = effectiveScore(data);
    shown = { ...shown, scoredInRound: round, score };
    if (!best || score > best.score!) best = shown;

    onRound?.({ round, maxRounds, verdict: data.verdict, critique: data.critique, score });

    if (data.verdict === 'accept') return finish('accepted');
    if (round === maxRounds) return finish('round_cap');
    if (data.changed.length === 0) return finish('stalled');

    apply(data.profile);
    shown = { profile: data.profile, scoredInRound: null, score: null };
  }

  return finish('round_cap');
}
