/**
 * The critique route's response, shared with the browser orchestrator.
 */
import type { VisualProfile } from '@/types/mood';
import type { PixelFailure, PixelReport } from '@/lib/critique/pixels';
import type { Adjustment, AdjustmentKnob } from '@/lib/critique/schema';
import type { ScoredRubric, Verdict } from '@/lib/critique/verdict';

export interface CritiqueResponse {
  round: number;
  maxRounds: number;
  verdict: Verdict;
  scores: ScoredRubric['scores'] | null;
  total: number | null;
  /** What in the screenshot drove the lowest score, in the critic's words. */
  evidence: string;
  critique: string;
  defect: string;
  /** The critic's adjustments the server applied, after dropping no-ops. */
  adjustments: Adjustment[];
  /** Knob names behind this revision, including any pixel fixes; empty on accept. */
  changed: AdjustmentKnob[];
  /** The profile to show next: adjusted and clamped on revise, unchanged on accept. */
  profile: VisualProfile;
  pixels: Omit<PixelReport, 'failures'>;
  forcedBy: PixelFailure[];
  source: 'model' | 'pixels_only';
}
