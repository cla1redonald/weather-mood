import { NextRequest, NextResponse } from 'next/server';
import {
  elevenlabsFetch,
  getCachedAudio,
  setCachedAudio,
  audioCacheKey,
} from '@/lib/elevenlabs/client';
import {
  guardGenerationRequest,
  InvalidJsonError,
  parseJsonBody,
  RequestBodyTooLargeError,
} from '@/lib/api-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ElevenLabs voice IDs mapped to voice personas
const VOICE_ID_MAP: Record<string, string> = {
  serene_female: '21m00Tcm4TlvDq8ikWAM',    // Rachel
  warm_male: 'ErXwobaYiN019PkySvjV',         // Antoni
  deep_male: 'pNInz6obpgDQGcFmaJgB',         // Adam
  gentle_female: 'MF3mGyEYCl7XYWbV9V6O',     // Elli
  contemplative_male: 'TxGEqnHWrfWFTfGW9XjX', // Josh
  ethereal_female: 'EXAVITQu4vr4xnSDxMaL',   // Sarah
  storyteller_male: '2EiwWnXFnvU5JabPnv8n',   // Clyde
  bright_female: 'AZnzlk1XvdvUeBnXmlld',     // Domi
};

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel

const NARRATE_LIMIT = {
  bucket: 'narrate',
  maxRequests: 12,
  windowSeconds: 60,
  maxBodyBytes: 12 * 1024,
};

function resolveVoiceId(voice?: string): string {
  if (process.env.ELEVENLABS_VOICE_ID) return process.env.ELEVENLABS_VOICE_ID;
  if (voice && VOICE_ID_MAP[voice]) return VOICE_ID_MAP[voice];
  return DEFAULT_VOICE_ID;
}

// Per-voice tuning for spoken word performance quality
// Each voice persona gets settings tuned to its character:
//   stability: Lower = more expressive variation (good for dramatic delivery)
//   similarity_boost: How closely to match the original voice
//   style: Higher = more performative and dramatic
//   speed: Varies per persona for natural delivery rhythm
const VOICE_PERFORMANCE_SETTINGS: Record<string, {
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
}> = {
  serene_female:        { stability: 0.40, similarity_boost: 0.75, style: 0.70, speed: 0.82 },
  warm_male:            { stability: 0.45, similarity_boost: 0.80, style: 0.65, speed: 0.85 },
  deep_male:            { stability: 0.35, similarity_boost: 0.75, style: 0.80, speed: 0.75 },  // Slow, dramatic
  gentle_female:        { stability: 0.45, similarity_boost: 0.80, style: 0.60, speed: 0.85 },
  contemplative_male:   { stability: 0.38, similarity_boost: 0.75, style: 0.75, speed: 0.78 },
  ethereal_female:      { stability: 0.30, similarity_boost: 0.70, style: 0.85, speed: 0.80 },  // Most expressive variation
  storyteller_male:     { stability: 0.35, similarity_boost: 0.80, style: 0.85, speed: 0.80 },  // Performative, dramatic pauses
  bright_female:        { stability: 0.50, similarity_boost: 0.80, style: 0.65, speed: 0.90 },  // Slightly faster, energetic
};

const DEFAULT_PERFORMANCE_SETTINGS = { stability: 0.40, similarity_boost: 0.75, style: 0.70, speed: 0.82 };

// Languages supported by ElevenLabs `eleven_multilingual_v2`.
// Out-of-list languages (e.g. Afrikaans 'af') cause a 4xx upstream; we skip narration for them.
const SUPPORTED_LANGUAGES = new Set([
  'en', 'ja', 'zh', 'de', 'hi', 'fr', 'ko', 'pt', 'it', 'es',
  'id', 'nl', 'tr', 'fil', 'tl', 'pl', 'sv', 'bg', 'ro', 'ar',
  'cs', 'el', 'fi', 'hr', 'ms', 'sk', 'da', 'ta', 'uk', 'ru',
  'hu', 'no', 'vi',
]);

interface NarrateInput {
  poem: string;            // English fallback (read aloud when languageCode is unsupported)
  poemLocal?: string;      // Translation in the local language
  voice?: string;
  languageCode?: string;
}

function validateInput(body: unknown): NarrateInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const { poem, poemLocal, voice, languageCode } = body as Record<string, unknown>;

  if (typeof poem !== 'string' || !poem.trim()) return null;

  return {
    poem: poem.trim(),
    poemLocal: typeof poemLocal === 'string' && poemLocal.trim() ? poemLocal.trim() : undefined,
    voice: typeof voice === 'string' ? voice : undefined,
    languageCode: typeof languageCode === 'string' && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(languageCode) ? languageCode : undefined,
  };
}

function hashPoem(poem: string): string {
  // Simple hash for cache key — not cryptographic, just for deduplication
  let hash = 0;
  for (let i = 0; i < poem.length; i++) {
    const char = poem.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return `poem_${hash}`;
}

export async function POST(request: NextRequest) {
  const guarded = await guardGenerationRequest(request, NARRATE_LIMIT);
  if (guarded) return guarded;

  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: 'Narration unavailable' },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await parseJsonBody(request, NARRATE_LIMIT.maxBodyBytes);
  } catch (err) {
    if (err instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    if (!(err instanceof InvalidJsonError)) console.error('Narration request parse error:', err);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const input = validateInput(body);
  if (!input) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const voiceId = resolveVoiceId(input.voice);

  // Check cache (include voice + language in key so different voices/accents are cached separately)
  const cacheKey = audioCacheKey('narrate', `${hashPoem(input.poem)}_${voiceId}_${input.languageCode || 'default'}`);
  const cached = getCachedAudio(cacheKey);
  if (cached) {
    return new NextResponse(cached, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'X-Source': 'cache',
      },
    });
  }

  // Strip region subtags (e.g. 'pt-BR' → 'pt') — ElevenLabs rejects them.
  const base = input.languageCode?.split('-')[0];
  const localSupported = !!base && SUPPORTED_LANGUAGES.has(base);

  // Pick what to narrate: local-language poem when the language is supported,
  // English fallback otherwise (so unknown languages still get spoken cleanly).
  const text = localSupported && input.poemLocal ? input.poemLocal : input.poem;
  const languageBody = localSupported && base !== 'en' ? { language_code: base } : {};

  try {
    // Get per-voice performance tuning (or default if voice persona not found)
    const perfSettings = (input.voice && VOICE_PERFORMANCE_SETTINGS[input.voice])
      ? VOICE_PERFORMANCE_SETTINGS[input.voice]
      : DEFAULT_PERFORMANCE_SETTINGS;

    const response = await elevenlabsFetch(`/text-to-speech/${voiceId}`, {
      text,
      model_id: 'eleven_multilingual_v2',
      ...languageBody,
      voice_settings: {
        stability: perfSettings.stability,
        similarity_boost: perfSettings.similarity_boost,
        style: perfSettings.style,
        speed: perfSettings.speed,
        use_speaker_boost: true,
      },
    });

    const [clientStream, cacheStream] = response.body!.tee();

    // Fire-and-forget: collect cacheStream into buffer for cache
    (async () => {
      try {
        const reader = cacheStream.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
        const buffer = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          buffer.set(chunk, offset);
          offset += chunk.length;
        }
        setCachedAudio(cacheKey, buffer.buffer as ArrayBuffer);
      } catch (err) {
        console.error('Failed to cache narration:', err);
      }
    })();

    return new NextResponse(clientStream, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'X-Source': 'ai',
      },
    });
  } catch (err) {
    console.error('Narration generation error:', err);
    return NextResponse.json(
      { error: 'Failed to generate narration' },
      { status: 500 }
    );
  }
}
