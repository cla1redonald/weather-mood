/**
 * The critique route's response, shared with the browser orchestrator.
 */
import type { VisualProfile } from '@/types/mood';
import type { PixelFailure, PixelReport } from '@/lib/critique/pixels';
import type { ProfilePatch } from '@/lib/critique/schema';
import type { ScoredRubric, Verdict } from '@/lib/critique/verdict';

export interface CritiqueResponse {
  round: number;
  maxRounds: number;
  verdict: Verdict;
  scores: ScoredRubric['scores'] | null;
  total: number | null;
  critique: string;
  defect: string;
  patch: ProfilePatch;
  changed: string[];
  /** The profile to show next: patched and clamped on revise, unchanged on accept. */
  profile: VisualProfile;
  pixels: Omit<PixelReport, 'failures'>;
  forcedBy: PixelFailure[];
  source: 'model' | 'pixels_only';
}
