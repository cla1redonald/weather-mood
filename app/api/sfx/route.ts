import { NextRequest, NextResponse } from 'next/server';
import {
  elevenlabsFetch,
  getCachedAudio,
  setCachedAudio,
  audioCacheKey,
} from '@/lib/elevenlabs/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SfxInput {
  city: string;
  condition: string;
  temperature: number;
}

function validateInput(body: unknown): SfxInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const { city, condition, temperature } = body as Record<string, unknown>;

  if (typeof city !== 'string' || !city.trim()) return null;
  if (typeof condition !== 'string' || !condition.trim()) return null;
  if (typeof temperature !== 'number' || !isFinite(temperature)) return null;

  return {
    city: city.trim(),
    condition: condition.trim(),
    temperature,
  };
}

function buildSfxPrompt(input: SfxInput): string {
  const lower = input.condition.toLowerCase();
  const tempDesc = input.temperature > 30 ? 'hot' :
    input.temperature > 20 ? 'warm' :
    input.temperature > 10 ? 'cool' :
    input.temperature > 0 ? 'cold' : 'freezing';

  if (lower.includes('thunder') || lower.includes('storm')) {
    return `Heavy rain and distant thunder in ${input.city}, wind gusting through streets, rain hitting windows and metal surfaces, ${tempDesc} storm atmosphere`;
  }
  if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('shower')) {
    return `Gentle rain falling in ${input.city}, water dripping from eaves, soft rain on leaves and pavement, occasional distant sounds, ${tempDesc} rain ambiance`;
  }
  if (lower.includes('snow') || lower.includes('blizzard') || lower.includes('sleet')) {
    return `Soft wind through snowy landscape in ${input.city}, muffled winter sounds, occasional crunch of snow, ${tempDesc} winter quiet`;
  }
  if (lower.includes('fog') || lower.includes('mist') || lower.includes('haze')) {
    return `Muffled city sounds in ${input.city} fog, distant echoes, damp atmosphere, sounds traveling strangely through thick air, ${tempDesc} misty ambiance`;
  }
  if (lower.includes('wind') || lower.includes('gale')) {
    return `Strong wind blowing through ${input.city}, whistling around buildings, rustling leaves and loose objects, ${tempDesc} windy atmosphere`;
  }
  if (lower.includes('clear') || lower.includes('sunny')) {
    return `Peaceful outdoor ambiance in ${input.city}, gentle breeze, birds singing softly, distant city sounds, ${tempDesc} clear day atmosphere`;
  }
  if (lower.includes('cloud') || lower.includes('overcast')) {
    return `Quiet overcast day in ${input.city}, gentle ambient sounds, soft breeze, distant urban hum, ${tempDesc} cloudy atmosphere`;
  }

  return `Atmospheric ambient sounds of ${input.city}, ${input.condition}, ${tempDesc} weather, immersive outdoor soundscape`;
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

  // Check cache
  const cacheKey = audioCacheKey('sfx', input.city, input.condition);
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
    const prompt = buildSfxPrompt(input);
    const response = await elevenlabsFetch('/sound-generation', {
      text: prompt,
      duration_seconds: 22,
      prompt_influence: 0.5,
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
    console.error('SFX generation error:', err);
    return NextResponse.json(
      { error: 'Failed to generate sound effects' },
      { status: 500 }
    );
  }
}
