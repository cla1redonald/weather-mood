import { NextRequest, NextResponse } from 'next/server';
import { buildMoodSystemPrompt, buildMoodUserMessage } from '@/lib/poem';
import { clampVisualProfile } from '@/types/mood';
import type { VisualProfile } from '@/types/mood';
import { validateFont } from '@/lib/fonts';
import {
  guardGenerationRequest,
  InvalidJsonError,
  parseJsonBody,
  RequestBodyTooLargeError,
} from '@/lib/api-guard';
import { reserveSpend } from '@/lib/spend-cap';
import { issueVisitToken } from '@/lib/visit-token';
import { createAnthropicClient } from '@/lib/claude/client';
import { DIRECTOR_EFFORT, DIRECTOR_MAX_TOKENS, directorModel } from '@/lib/claude/config';
import { requestStructured } from '@/lib/claude/structured';
import { MoodSchema } from '@/lib/mood/schema';
import { buildFallbackProfile } from '@/lib/mood/fallback';
import { textOr, validateLanguageCode, validateMoodInput, validateVoicePersona } from '@/lib/mood/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Each mood generation buys one music, one sfx and one narration call, plus up
// to three critique rounds, so this is the limit that bounds spend per
// visitor. A burst limit and a daily limit.
const MOOD_LIMIT = {
  bucket: 'mood',
  maxRequests: 4,
  windowSeconds: 10 * 60,
  maxBodyBytes: 8 * 1024,
};

const MOOD_DAILY_LIMIT = {
  bucket: 'mood-day',
  maxRequests: 12,
  windowSeconds: 24 * 60 * 60,
  maxBodyBytes: 8 * 1024,
};

function fallbackResponse(condition: string, visitToken: string | null, source: string): NextResponse {
  const fallback = buildFallbackProfile(condition);
  return NextResponse.json({
    poem: fallback.poem,
    poemLocal: fallback.poem,
    visual: fallback.visual,
    voice: fallback.voice,
    fontFamily: 'Lora',
    languageCode: 'en',
    musicDirection: fallback.musicDirection,
    ambienceDirection: fallback.ambienceDirection,
    cached: false,
    visitToken,
    _source: source,
  });
}

export async function POST(request: NextRequest) {
  const guarded = await guardGenerationRequest(request, MOOD_LIMIT);
  if (guarded) return guarded;
  const guardedDaily = await guardGenerationRequest(request, MOOD_DAILY_LIMIT);
  if (guardedDaily) return guardedDaily;

  let body: unknown;
  try {
    body = await parseJsonBody(request, MOOD_LIMIT.maxBodyBytes);
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    if (!(err instanceof InvalidJsonError)) console.error('Mood request parse error:', err);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const input = validateMoodInput(body);
  if (!input) {
    return NextResponse.json(
      {
        error:
          'Invalid input. Required: city (string), temperature (number), condition (string), humidity (number), windSpeed (number), cloudCover (number)',
      },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Mood generation unavailable' }, { status: 503 });
  }

  // Reserved only once the request is valid and will reach Claude.
  const spend = await reserveSpend('mood');
  if (!spend.allowed) {
    console.warn(`[spend-cap] Daily cap reached: ${spend.spentCents}c of ${spend.capCents}c (shared=${spend.shared})`);
    return NextResponse.json({ error: 'Daily generation budget reached. Try again tomorrow.' }, { status: 503 });
  }

  // The token lets the client make one music, one sfx and one narration call
  // and up to three critique rounds for this generation. See lib/visit-token.ts.
  const visitToken = issueVisitToken();

  try {
    const outcome = await requestStructured(
      createAnthropicClient(apiKey),
      {
        model: directorModel(),
        maxTokens: DIRECTOR_MAX_TOKENS,
        effort: DIRECTOR_EFFORT,
        system: buildMoodSystemPrompt(),
        content: buildMoodUserMessage(input),
      },
      MoodSchema,
    );

    if (outcome.kind === 'refusal') {
      console.warn(`Mood generation: refused (category=${outcome.category ?? 'none'})`);
      return fallbackResponse(input.condition, visitToken, 'fallback:refusal');
    }
    if (outcome.kind === 'max_tokens') {
      console.error(`Mood generation: hit max_tokens (${DIRECTOR_MAX_TOKENS})`);
      return fallbackResponse(input.condition, visitToken, 'fallback:max_tokens');
    }
    if (outcome.kind === 'malformed') {
      console.error('Mood generation: reply did not match the schema:', outcome.detail.slice(0, 300));
      return fallbackResponse(input.condition, visitToken, 'fallback:malformed');
    }

    const parsed = outcome.data;
    const fallback = buildFallbackProfile(input.condition);

    // Structured outputs fix the shape, not the values: the clamp and the
    // validators stay as defence in depth.
    const poem = textOr(parsed.poem, fallback.poem);
    const poemLocal = textOr(parsed.poemLocal, poem);
    // The schema's number arrays become RGB tuples and ranges here; the clamp
    // checks every length and value, which is why the cast is safe.
    const visual = clampVisualProfile(parsed.visual as unknown as Partial<VisualProfile>);
    const voice = validateVoicePersona(parsed.voice);
    const fontFamily = validateFont(parsed.fontFamily);
    const languageCode = validateLanguageCode(parsed.languageCode);
    const musicDirection = textOr(parsed.musicDirection, fallback.musicDirection);
    const ambienceDirection = textOr(parsed.ambienceDirection, fallback.ambienceDirection);

    return NextResponse.json({ poem, poemLocal, visual, voice, fontFamily, languageCode, musicDirection, ambienceDirection, cached: false, visitToken, _source: 'ai' });
  } catch (err) {
    console.error('Mood generation error:', err);
    return NextResponse.json(
      { error: 'Failed to generate mood profile' },
      { status: 500 }
    );
  }
}
