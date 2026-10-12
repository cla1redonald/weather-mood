/**
 * Accept or revise, decided in code. The model supplies scores; it never
 * supplies the verdict.
 */
import { ACCEPT_THRESHOLD } from '@/lib/critique/limits';
import { RUBRIC_CRITERIA, type CritiqueOutput, type RubricCriterion } from '@/lib/critique/schema';
import type { PixelFailure } from '@/lib/critique/pixels';

export type Verdict = 'accept' | 'revise';

export interface ScoredRubric {
  scores: Record<RubricCriterion, number>;
  /** Sum of the five scores, 5 to 25. Used to pick the best version. */
  total: number;
  lowest: number;
}

/** Clamp each score to a whole number from 1 to 5; anything unusable is a 1. */
export function normaliseScores(raw: CritiqueOutput['scores']): ScoredRubric {
  const scores = {} as ScoredRubric['scores'];
  let total = 0;
  let lowest = 5;
  for (const key of RUBRIC_CRITERIA) {
    const value = Number(raw?.[key]);
    const score = Number.isFinite(value) ? Math.min(5, Math.max(1, Math.round(value))) : 1;
    scores[key] = score;
    total += score;
    lowest = Math.min(lowest, score);
  }
  return { scores, total, lowest };
}

export function computeVerdict(rubric: ScoredRubric, pixelFailures: PixelFailure[]): Verdict {
  if (pixelFailures.length > 0) return 'revise';
  return rubric.lowest >= ACCEPT_THRESHOLD ? 'accept' : 'revise';
}
