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
    const response = await elevenlabsFetch(`/text-to-speech/${voiceId}`, {
      text: input.poem,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.7,
        similarity_boost: 0.8,
        style: 0.4,
        speed: 0.85, // Slightly slower for atmospheric delivery
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
