import { NextRequest, NextResponse } from 'next/server';
import { elevenlabsFetch } from '@/lib/elevenlabs/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SfxInput {
  ambienceDirection: string;
}

function validateInput(body: unknown): SfxInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const { ambienceDirection } = body as Record<string, unknown>;

  if (typeof ambienceDirection !== 'string' || !ambienceDirection.trim()) return null;

  return {
    ambienceDirection: ambienceDirection.trim(),
  };
}

// ElevenLabs sound-generation endpoint rejects text >450 chars.
const ELEVENLABS_SFX_MAX_LEN = 450;
const SFX_SUFFIX = 'Cinematic, atmospheric, loopable field recording — layered and alive.';

function buildSfxPrompt(input: SfxInput): string {
  const headroom = ELEVENLABS_SFX_MAX_LEN - SFX_SUFFIX.length - 1; // -1 for the joining space
  const direction = input.ambienceDirection.length > headroom
    ? input.ambienceDirection.slice(0, headroom).replace(/[\s,.\-—]+\S*$/, '').trim()
    : input.ambienceDirection;
  return `${direction} ${SFX_SUFFIX}`;
}

export async function POST(request: NextRequest) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: 'Sound effects generation unavailable' },
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

  const prompt = buildSfxPrompt(input);
  const MAX_ATTEMPTS = 2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await elevenlabsFetch('/sound-generation', {
        text: prompt,
        duration_seconds: 10,
        prompt_influence: 0.75,
      });

      return new NextResponse(response.body, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'X-Source': 'ai',
        },
      });
    } catch (err) {
      console.error(`SFX generation error (attempt ${attempt}/${MAX_ATTEMPTS}):`, err);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return NextResponse.json(
        { error: 'Failed to generate sound effects' },
        { status: 500 }
      );
    }
  }
}
