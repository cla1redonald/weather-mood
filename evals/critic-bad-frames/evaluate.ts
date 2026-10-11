/**
 * The critic-bad-frames eval. Offline mode runs the deterministic pixel checks
 * on every synthetic frame, encoded and decoded exactly as in production, and
 * costs nothing. Live mode also asks the model critic about each frame that
 * has an expected verdict, and reports what that cost.
 */
import type { MessagesClient } from '@/lib/claude/structured';
import { requestStructured } from '@/lib/claude/structured';
import { CRITIC_EFFORT, CRITIC_MAX_TOKENS, criticModel } from '@/lib/claude/config';
import { decodeCritiqueImage } from '@/lib/critique/image';
import { analysePixels, type PixelReport } from '@/lib/critique/pixels';
import { buildCriticSystemPrompt, buildCriticUserContent } from '@/lib/critique/prompt';
import { CritiqueSchema } from '@/lib/critique/schema';
import { computeVerdict, normaliseScores } from '@/lib/critique/verdict';
import { clampVisualProfile, type VisualProfile } from '@/types/mood';
import type { MoodInput } from '@/lib/poem';
import { encodeLikeBrowser, FRAME_CASES, type FrameCase, type Verdict } from './frames';

/** Sonnet 5.5 list prices, US dollars per million tokens. */
export const PRICE_PER_MTOK = { input: 2, output: 10 };
/** Pre-run estimate per critic call, from the token arithmetic in lib/spend-cap.ts. */
export const ESTIMATED_CENTS_PER_CALL = 1.7;

export interface OfflineResult {
  id: string;
  jpegKb: number;
  quality: number;
  pixels: PixelReport;
  expected: 'fail' | 'pass';
  actual: 'fail' | 'pass';
  ok: boolean;
}

export interface LiveResult {
  id: string;
  expected: Verdict;
  actual: Verdict | 'no_reply';
  ok: boolean;
  lowestScore: number | null;
  critique: string;
  inputTokens: number;
  outputTokens: number;
}

function decodeCase(frame: FrameCase) {
  const { jpeg, quality } = encodeLikeBrowser(frame.render());
  const decoded = decodeCritiqueImage(`data:image/jpeg;base64,${jpeg.toString('base64')}`);
  if (!decoded.ok) throw new Error(`Frame ${frame.id} did not decode: ${decoded.reason}`);
  return { decoded, jpegKb: jpeg.length / 1024, quality };
}

export function runOfflineEval(cases: FrameCase[] = FRAME_CASES): OfflineResult[] {
  return cases.map((frame) => {
    const { decoded, jpegKb, quality } = decodeCase(frame);
    const pixels = analysePixels(decoded.rgba, decoded.width, decoded.height);
    const actual = pixels.failures.length > 0 ? 'fail' : 'pass';
    return { id: frame.id, jpegKb, quality, pixels, expected: frame.expectedPixels, actual, ok: actual === frame.expectedPixels };
  });
}

/** Each frame is presented as a dusk scene in a mild, clear city. */
export const EVAL_WEATHER: MoodInput = {
  city: 'Lisbon', country: 'Portugal', temperature: 19, condition: 'clear', humidity: 62,
  windSpeed: 11, cloudCover: 5, weatherCode: 0, windDirection: 300, uvIndex: 0,
};

export const EVAL_PROFILE: VisualProfile = clampVisualProfile({
  background: { topColor: [34, 46, 84], bottomColor: [118, 100, 140], style: 'linear' },
  particles: {
    colors: [[250, 205, 140], [240, 190, 130], [255, 220, 170], [230, 180, 120]],
    maxCount: 120, spawnRate: 10, sizeRange: [3, 10], alphaRange: [0.3, 0.6], speedRange: [0.3, 1.2],
    direction: 'up', lifespan: [6, 14], drawStyle: 'glow',
  },
  effects: {
    ripples: { active: false, color: [0, 0, 0], rate: 5 },
    lightning: { active: false, interval: [5, 15] },
    cloudNoise: { active: false, opacity: 0.05, scale: 0.003 },
    glow: { active: true, color: [250, 200, 140], intensity: 0.35 },
  },
  description: 'Slate-to-violet dusk with warm glowing particles drifting up',
});

export function liveCases(cases: FrameCase[] = FRAME_CASES): Array<FrameCase & { expectedVerdict: Verdict }> {
  return cases.filter((c): c is FrameCase & { expectedVerdict: Verdict } => c.expectedVerdict !== null);
}

export async function runLiveEval(client: MessagesClient, cases: FrameCase[] = FRAME_CASES): Promise<LiveResult[]> {
  const results: LiveResult[] = [];
  for (const frame of liveCases(cases)) {
    const { decoded } = decodeCase(frame);
    const pixels = analysePixels(decoded.rgba, decoded.width, decoded.height);
    const outcome = await requestStructured(
      client,
      {
        model: criticModel(),
        maxTokens: CRITIC_MAX_TOKENS,
        effort: CRITIC_EFFORT,
        system: buildCriticSystemPrompt(),
        content: buildCriticUserContent({ imageBase64: decoded.base64, profile: EVAL_PROFILE, weather: EVAL_WEATHER, round: 1, pixels }),
      },
      CritiqueSchema,
    );

    if (outcome.kind !== 'ok') {
      // Mirror the route: pixel failures still force a revise without the model.
      const actual: Verdict | 'no_reply' = pixels.failures.length > 0 ? 'revise' : 'no_reply';
      results.push({
        id: frame.id, expected: frame.expectedVerdict, actual, ok: actual === frame.expectedVerdict,
        lowestScore: null, critique: `(${outcome.kind})`, inputTokens: 0, outputTokens: 0,
      });
      continue;
    }

    const rubric = normaliseScores(outcome.data.scores);
    const actual = computeVerdict(rubric, pixels.failures);
    results.push({
      id: frame.id,
      expected: frame.expectedVerdict,
      actual,
      ok: actual === frame.expectedVerdict,
      lowestScore: rubric.lowest,
      critique: outcome.data.critique,
      inputTokens: outcome.usage.input_tokens,
      outputTokens: outcome.usage.output_tokens,
    });
  }
  return results;
}

export function costCents(results: LiveResult[]): number {
  const input = results.reduce((sum, r) => sum + r.inputTokens, 0);
  const output = results.reduce((sum, r) => sum + r.outputTokens, 0);
  return ((input * PRICE_PER_MTOK.input + output * PRICE_PER_MTOK.output) / 1_000_000) * 100;
}
