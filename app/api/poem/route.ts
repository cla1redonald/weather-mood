import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  getCacheKey,
  getCachedPoem,
  setCachedPoem,
  buildSystemPrompt,
  buildUserMessage,
} from '@/lib/poem';
import type { PoemInput } from '@/lib/poem';

export const runtime = 'edge';

function validateInput(body: unknown): PoemInput | null {
  if (typeof body !== 'object' || body === null) return null;

  const { city, temperature, condition, humidity, windSpeed } = body as Record<string, unknown>;

  if (typeof city !== 'string' || city.trim().length === 0) return null;
  if (typeof temperature !== 'number' || !isFinite(temperature)) return null;
  if (typeof condition !== 'string' || condition.trim().length === 0) return null;
  if (typeof humidity !== 'number' || !isFinite(humidity)) return null;
  if (typeof windSpeed !== 'number' || !isFinite(windSpeed)) return null;

  return {
    city: city.trim(),
    temperature,
    condition: condition.trim(),
    humidity,
    windSpeed,
  };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Poem generation unavailable' },
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
    return NextResponse.json(
      { error: 'Invalid input. Required: city (string), temperature (number), condition (string), humidity (number), windSpeed (number)' },
      { status: 400 }
    );
  }

  // Check cache
  const cacheKey = getCacheKey(input.city, input.condition);
  const cachedPoem = getCachedPoem(cacheKey);
  if (cachedPoem) {
    return NextResponse.json({ poem: cachedPoem, cached: true });
  }

  // Generate poem via Claude API
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: buildSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: buildUserMessage(input),
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    const poem = textBlock ? textBlock.text.trim() : '';

    if (!poem) {
      return NextResponse.json(
        { error: 'Failed to generate poem' },
        { status: 500 }
      );
    }

    setCachedPoem(cacheKey, poem);
    return NextResponse.json({ poem, cached: false });
  } catch (err) {
    console.error('Poem generation error:', err);
    return NextResponse.json(
      { error: 'Failed to generate poem' },
      { status: 500 }
    );
  }
}
