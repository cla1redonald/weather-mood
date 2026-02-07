import { NextRequest, NextResponse } from 'next/server';
import { elevenlabsFetch } from '@/lib/elevenlabs/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface MusicInput {
  musicDirection: string;
  poem: string;
}

function validateInput(body: unknown): MusicInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const { musicDirection, poem } = body as Record<string, unknown>;

  if (typeof musicDirection !== 'string' || !musicDirection.trim()) return null;
  if (typeof poem !== 'string' || !poem.trim()) return null;

  return {
    musicDirection: musicDirection.trim(),
    poem: poem.trim(),
  };
}

function buildMusicPrompt(input: MusicInput): string {
  return [
    input.musicDirection,
    `This music accompanies the following poem — match its emotional arc: "${input.poem}"`,
    'IMPORTANT: This must be MELODIC and MUSICAL — use real instruments, harmonies, and memorable phrases.',
    'It should NOT sound like a drone, a soundscape, or white noise.',
    'Make it evolve: introduce elements gradually, build to a gentle peak, and resolve. Cinematic and emotionally moving.',
  ].join(' ');
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

  try {
    const prompt = buildMusicPrompt(input);
    const response = await elevenlabsFetch('/music/stream', {
      prompt,
      music_length_ms: 30000,
      force_instrumental: true,
      model_id: 'music_v1',
    });

    return new NextResponse(response.body, {
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
