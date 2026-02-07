import { NextRequest, NextResponse } from 'next/server';
import {
  elevenlabsFetch,
  getCachedAudio,
  setCachedAudio,
  audioCacheKey,
} from '@/lib/elevenlabs/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface MusicInput {
  city: string;
  condition: string;
  temperature: number;
  poem: string;
  soundDescription: string;
}

function validateInput(body: unknown): MusicInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const { city, condition, temperature, poem, soundDescription } =
    body as Record<string, unknown>;

  if (typeof city !== 'string' || !city.trim()) return null;
  if (typeof condition !== 'string' || !condition.trim()) return null;
  if (typeof temperature !== 'number' || !isFinite(temperature)) return null;
  if (typeof poem !== 'string' || !poem.trim()) return null;
  if (typeof soundDescription !== 'string') return null;

  return {
    city: city.trim(),
    condition: condition.trim(),
    temperature,
    poem: poem.trim(),
    soundDescription: (soundDescription || '').trim(),
  };
}

function buildMusicPrompt(input: MusicInput): string {
  const poemLines = input.poem.split('\n').slice(0, 2).join(' / ');
  return [
    'Ambient, atmospheric, instrumental music.',
    `Inspired by this poem about ${input.city} weather: "${poemLines}".`,
    input.soundDescription ? `The mood is: ${input.soundDescription}.` : '',
    `Weather: ${input.condition} at ${Math.round(input.temperature)}°C.`,
    'Create a gentle, evolving soundscape that evokes this specific place and moment.',
    'Should feel cinematic and immersive, suitable for looping.',
  ].filter(Boolean).join(' ');
}

export async function POST(request: NextRequest) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: 'Music generation unavailable' },
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

  // Check cache
  const cacheKey = audioCacheKey('music', input.city, input.condition);
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
    const prompt = buildMusicPrompt(input);
    const response = await elevenlabsFetch('/music/stream', {
      prompt,
      music_length_ms: 90000, // 90 seconds
      force_instrumental: true,
      model_id: 'music_v1',
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
    console.error('Music generation error:', err);
    return NextResponse.json(
      { error: 'Failed to generate music' },
      { status: 500 }
    );
  }
}
