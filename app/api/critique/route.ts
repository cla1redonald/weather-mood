/**
 * POST /api/critique: Claude looks at a screenshot of the canvas it designed,
 * scores it against the weather, and proposes a patch.
 *
 * Checks run cheapest first, and nothing is spent until the request is known
 * to be valid: per-IP limit, visit token, body and image validation, the
 * per-token round cap, then the daily spend cap, then the model call.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  claimCritiqueRound,
  guardGenerationRequest,
  InvalidJsonError,
  parseJsonBody,
  RequestBodyTooLargeError,
} from '@/lib/api-guard';
import { reserveSpend } from '@/lib/spend-cap';
import { VISIT_TOKEN_HEADER, verifyVisitToken } from '@/lib/visit-token';
import { clampVisualProfile, type VisualProfile } from '@/types/mood';
import { validateMoodInput } from '@/lib/mood/validate';
import { createAnthropicClient } from '@/lib/claude/client';
import { CRITIC_EFFORT, CRITIC_MAX_TOKENS, criticModel } from '@/lib/claude/config';
import { requestStructured } from '@/lib/claude/structured';
import { CritiqueSchema } from '@/lib/critique/schema';
import { decodeCritiqueImage } from '@/lib/critique/image';
import { analysePixels, type PixelFailure, type PixelReport } from '@/lib/critique/pixels';
import { applyPatch, changedFields, mergePatches, pixelFixPatch } from '@/lib/critique/patch';
import { computeVerdict, normaliseScores } from '@/lib/critique/verdict';
import { buildCriticSystemPrompt, buildCriticUserContent } from '@/lib/critique/prompt';
import { MAX_CRITIQUE_IMAGE_BYTES, MAX_CRITIQUE_ROUNDS } from '@/lib/critique/limits';
import type { CritiqueResponse } from '@/lib/critique/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Three rounds per mood, and the mood route allows four moods per ten minutes.
// The body allowance covers a 150 KB image as base64 plus the profile.
const CRITIQUE_LIMIT = {
  bucket: 'critique',
  maxRequests: 12,
  windowSeconds: 10 * 60,
  maxBodyBytes: Math.ceil((MAX_CRITIQUE_IMAGE_BYTES * 4) / 3) + 16 * 1024,
};

const PIXEL_FAILURE_TEXT: Record<PixelFailure, string> = {
  blank: 'the frame is nearly blank, bringing the particles forward',
  too_dark: 'the frame is too dark to read, lifting the background',
  washed_out: 'the frame is washed out, deepening the sky',
  cluttered: 'the frame is too busy, thinning the particles',
};

/** One readable sentence for the ticker: no em or en dashes, bounded length. */
function tidySentence(text: string): string {
  const cleaned = text.replace(/\s*[–—]\s*/g, ', ').replace(/!/g, '.').replace(/\s+/g, ' ').trim();
  return cleaned.length > 160 ? `${cleaned.slice(0, 157).trimEnd()}...` : cleaned;
}

function publicPixels(report: PixelReport): CritiqueResponse['pixels'] {
  const { meanLuminance, luminanceStdDev, edgeDensity, poemRegionLuminance } = report;
  return { meanLuminance, luminanceStdDev, edgeDensity, poemRegionLuminance };
}

export async function POST(request: NextRequest) {
  const limited = await guardGenerationRequest(request, CRITIQUE_LIMIT);
  if (limited) return limited;

  const token = verifyVisitToken(request.headers.get(VISIT_TOKEN_HEADER));
  if (!token.ok) {
    if (token.reason === 'disabled') {
      console.error('[visit-token] VISIT_TOKEN_SECRET is not set; the critique route is disabled.');
      return NextResponse.json({ error: 'Critique unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: 'A valid visit token is required', reason: token.reason }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await parseJsonBody(request, CRITIQUE_LIMIT.maxBodyBytes);
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    if (!(err instanceof InvalidJsonError)) console.error('Critique request parse error:', err);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { image, profile: rawProfile, weather: rawWeather, round: clientRound } = (body ?? {}) as Record<string, unknown>;
  const weather = validateMoodInput(rawWeather);
  if (!weather || typeof rawProfile !== 'object' || rawProfile === null) {
    return NextResponse.json({ error: 'Invalid input. Required: image, profile, weather, round' }, { status: 400 });
  }
  if (typeof clientRound !== 'number' || !Number.isInteger(clientRound) || clientRound < 1 || clientRound > MAX_CRITIQUE_ROUNDS + 1) {
    return NextResponse.json({ error: `round must be a whole number from 1 to ${MAX_CRITIQUE_ROUNDS}` }, { status: 400 });
  }

  const decoded = decodeCritiqueImage(image);
  if (!decoded.ok) {
    if (decoded.reason === 'too_large') {
      return NextResponse.json({ error: `Image larger than ${MAX_CRITIQUE_IMAGE_BYTES / 1024} KB` }, { status: 413 });
    }
    return NextResponse.json({ error: 'Image must be a 768x432 JPEG data URL', reason: decoded.reason }, { status: 400 });
  }

  // The server's own count is the authority; the client's round is a hint.
  const claim = await claimCritiqueRound(token.claims.id, MAX_CRITIQUE_ROUNDS);
  if (!claim.allowed) {
    return NextResponse.json(
      { error: `This visit has used all ${MAX_CRITIQUE_ROUNDS} critique rounds` },
      { status: 429, headers: { 'Retry-After': '900' } },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Critique unavailable' }, { status: 503 });
  }

  const spend = await reserveSpend('critique');
  if (!spend.allowed) {
    console.warn(`[spend-cap] Daily cap reached: ${spend.spentCents}c of ${spend.capCents}c (shared=${spend.shared})`);
    return NextResponse.json({ error: 'Daily generation budget reached. Try again tomorrow.' }, { status: 503 });
  }

  const current = clampVisualProfile(rawProfile as Partial<VisualProfile>);
  const pixels = analysePixels(decoded.rgba, decoded.width, decoded.height);
  const pixelPatch = pixelFixPatch(pixels, current);

  let outcome;
  try {
    outcome = await requestStructured(
      createAnthropicClient(apiKey),
      {
        model: criticModel(),
        maxTokens: CRITIC_MAX_TOKENS,
        effort: CRITIC_EFFORT,
        system: buildCriticSystemPrompt(),
        content: buildCriticUserContent({ imageBase64: decoded.base64, profile: current, weather, round: claim.round, pixels }),
      },
      CritiqueSchema,
    );
  } catch (err) {
    console.error('Critique API error:', err);
    outcome = null;
  }

  if (!outcome || outcome.kind !== 'ok') {
    if (outcome) console.warn(`Critique: no usable reply (${outcome.kind})`);
    // The pixel checks still stand on their own: a black frame gets fixed
    // even if the model refused or the call failed.
    if (pixels.failures.length > 0) {
      const response: CritiqueResponse = {
        round: claim.round,
        maxRounds: MAX_CRITIQUE_ROUNDS,
        verdict: 'revise',
        scores: null,
        total: null,
        critique: PIXEL_FAILURE_TEXT[pixels.failures[0]],
        defect: `Automatic checks failed: ${pixels.failures.join(', ')}.`,
        patch: pixelPatch,
        changed: changedFields(pixelPatch),
        profile: applyPatch(current, pixelPatch),
        pixels: publicPixels(pixels),
        forcedBy: pixels.failures,
        source: 'pixels_only',
      };
      return NextResponse.json(response);
    }
    return NextResponse.json(
      { error: 'The critic could not review this frame', reason: outcome?.kind ?? 'api_error' },
      { status: 502 },
    );
  }

  const rubric = normaliseScores(outcome.data.scores);
  const verdict = computeVerdict(rubric, pixels.failures);
  const patch = verdict === 'revise'
    ? mergePatches(outcome.data.patch, pixels.failures.length > 0 ? pixelPatch : {})
    : {};

  const response: CritiqueResponse = {
    round: claim.round,
    maxRounds: MAX_CRITIQUE_ROUNDS,
    verdict,
    scores: rubric.scores,
    total: rubric.total,
    critique: tidySentence(outcome.data.critique),
    defect: tidySentence(outcome.data.defect),
    patch,
    changed: changedFields(patch),
    profile: verdict === 'revise' ? applyPatch(current, patch) : current,
    pixels: publicPixels(pixels),
    forcedBy: pixels.failures,
    source: 'model',
  };
  return NextResponse.json(response);
}
