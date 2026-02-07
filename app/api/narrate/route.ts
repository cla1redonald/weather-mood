import { NextRequest, NextResponse } from 'next/server';
import {
  elevenlabsFetch,
  getCachedAudio,
  setCachedAudio,
  audioCacheKey,
} from '@/lib/elevenlabs/client';

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

interface NarrateInput {
  poem: string;
  voice?: string;
}

function validateInput(body: unknown): NarrateInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const { poem, voice } = body as Record<string, unknown>;

  if (typeof poem !== 'string' || !poem.trim()) return null;

  return {
    poem: poem.trim(),
    voice: typeof voice === 'string' ? voice : undefined,
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
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: 'Narration unavailable' },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const input = validateInput(body);
  if (!input) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const voiceId = resolveVoiceId(input.voice);

  // Check cache (include voice in key so different voices are cached separately)
  const cacheKey = audioCacheKey('narrate', `${hashPoem(input.poem)}_${voiceId}`);
  const cached = getCachedAudio(cacheKey);
  if (cached) {
    return new NextResponse(cached, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'X-Source': 'cache',
      },
    });
  }

  try {
    // Get per-voice performance tuning (or default if voice persona not found)
    const perfSettings = (input.voice && VOICE_PERFORMANCE_SETTINGS[input.voice])
      ? VOICE_PERFORMANCE_SETTINGS[input.voice]
      : DEFAULT_PERFORMANCE_SETTINGS;

    const response = await elevenlabsFetch(`/text-to-speech/${voiceId}`, {
      text: input.poem,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: perfSettings.stability,
        similarity_boost: perfSettings.similarity_boost,
        style: perfSettings.style,
        speed: perfSettings.speed,
        use_speaker_boost: true,
      },
    });

    const buffer = await response.arrayBuffer();
    setCachedAudio(cacheKey, buffer);

    return new NextResponse(buffer, {
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
