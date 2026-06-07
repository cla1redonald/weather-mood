import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  buildMoodSystemPrompt,
  buildMoodUserMessage,
} from '@/lib/poem';
import type { MoodInput } from '@/lib/poem';
import {
  clampVisualProfile,
} from '@/types/mood';
import type { VisualProfile } from '@/types/mood';
import { validateFont } from '@/lib/fonts';
import {
  guardGenerationRequest,
  InvalidJsonError,
  parseJsonBody,
  RequestBodyTooLargeError,
} from '@/lib/api-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_VOICE_PERSONAS = [
  'serene_female', 'warm_male', 'deep_male', 'gentle_female',
  'contemplative_male', 'ethereal_female', 'storyteller_male', 'bright_female',
] as const;

const MOOD_LIMIT = {
  bucket: 'mood',
  maxRequests: 8,
  windowSeconds: 60,
  maxBodyBytes: 8 * 1024,
};

function validateVoicePersona(voice: unknown): string {
  if (typeof voice === 'string' && VALID_VOICE_PERSONAS.includes(voice as typeof VALID_VOICE_PERSONAS[number])) {
    return voice;
  }
  return 'serene_female'; // default fallback
}

function validateInput(body: unknown): MoodInput | null {
  if (typeof body !== 'object' || body === null) return null;

  const { city, country, temperature, condition, humidity, windSpeed, cloudCover, weatherCode, windDirection, uvIndex } =
    body as Record<string, unknown>;

  if (typeof city !== 'string' || city.trim().length === 0) return null;
  if (typeof temperature !== 'number' || !isFinite(temperature)) return null;
  if (typeof condition !== 'string' || condition.trim().length === 0) return null;
  if (typeof humidity !== 'number' || !isFinite(humidity)) return null;
  if (typeof windSpeed !== 'number' || !isFinite(windSpeed)) return null;
  if (typeof cloudCover !== 'number' || !isFinite(cloudCover)) return null;

  return {
    city: city.trim(),
    country: typeof country === 'string' ? country.trim() : undefined,
    temperature,
    condition: condition.trim(),
    humidity,
    windSpeed,
    cloudCover,
    weatherCode: typeof weatherCode === 'number' ? weatherCode : 0,
    windDirection: typeof windDirection === 'number' ? windDirection : 0,
    uvIndex: typeof uvIndex === 'number' ? uvIndex : 0,
  };
}

/**
 * Build a fallback mood profile based on the weather condition.
 * Used when Claude returns invalid JSON.
 */
function buildFallbackProfile(condition: string): {
  poem: string;
  visual: VisualProfile;
  voice: string;
  musicDirection: string;
  ambienceDirection: string;
} {
  const lower = condition.toLowerCase();

  const isRainy = lower.includes('rain') || lower.includes('drizzle') || lower.includes('shower');
  const isStormy = lower.includes('thunder') || lower.includes('storm');
  const isCloudy = lower.includes('cloud') || lower.includes('overcast');
  const isSnowy = lower.includes('snow') || lower.includes('sleet') || lower.includes('blizzard');
  const isClear = lower.includes('clear') || lower.includes('sunny');
  const isFoggy = lower.includes('fog') || lower.includes('mist') || lower.includes('haze');

  let poem = 'The weather wraps the city\nin its quiet, shifting cloak\nmoments pass like clouds\nabove the rooftops.';

  let visual: VisualProfile = {
    background: { topColor: [120, 140, 170], bottomColor: [160, 175, 200], style: 'linear' },
    particles: {
      colors: [[180, 190, 210], [160, 170, 190], [200, 210, 230], [140, 150, 170]],
      maxCount: 120, spawnRate: 10, sizeRange: [2, 6], alphaRange: [0.3, 0.7],
      speedRange: [1, 3], direction: 'down', lifespan: [4, 10], drawStyle: 'circle',
    },
    effects: {
      ripples: { active: false, color: [0, 0, 0], rate: 5 },
      lightning: { active: false, interval: [5, 15] },
      cloudNoise: { active: false, opacity: 0.08, scale: 0.003 },
      glow: { active: false, color: [0, 0, 0], intensity: 0 },
    },
    description: 'Neutral blue-grey gradient with gentle particles',
  };

  let voice = 'serene_female'; // default
  let musicDirection = 'Gentle ambient piano with soft string pads, unhurried and contemplative. A simple repeating melody that feels like watching clouds drift. Around 65 BPM, warm and meditative.';
  let ambienceDirection = 'A quiet city street: distant traffic hum, occasional footsteps, a gentle breeze carrying indistinct sounds. Calm and unremarkable, like a moment between moments.';

  if (isStormy) {
    poem = 'Thunder rolls through the streets\nrain hammers the tin awnings\nlightning splits the dusk\nthe city holds its breath.';
    voice = 'deep_male';
    musicDirection = 'Dramatic orchestral swells with deep timpani rolls, low brass drones building tension, and distorted cello stabs. Minor key, around 70 BPM, cinematic and foreboding — like the sky is about to split open.';
    ambienceDirection = 'A violent urban thunderstorm: heavy rain hammering metal awnings, deep chest-rattling thunder, wind gusting through narrow streets, water rushing through gutters. Brief moments of eerie quiet between strikes.';
    visual = {
      background: { topColor: [20, 25, 35], bottomColor: [40, 50, 65], style: 'linear' },
      particles: {
        colors: [[140, 160, 180], [100, 120, 140], [80, 100, 120], [60, 80, 100]],
        maxCount: 350, spawnRate: 35, sizeRange: [1, 4], alphaRange: [0.4, 0.9],
        speedRange: [8, 14], direction: 'down', lifespan: [1, 3], drawStyle: 'line',
      },
      effects: {
        ripples: { active: true, color: [80, 110, 130], rate: 15 },
        lightning: { active: true, interval: [4, 12] },
        cloudNoise: { active: true, opacity: 0.14, scale: 0.005 },
        glow: { active: false, color: [0, 0, 0], intensity: 0 },
      },
      description: 'Dark gradient with rain lines, lightning, and ripples',
    };
  } else if (isRainy) {
    poem = 'Rain taps a patient rhythm\non the shoulders of the street\nthe gutters hum their small songs\nwhile umbrellas bloom like flowers.';
    voice = 'serene_female';
    musicDirection = 'Intimate jazz piano with brushed snare and muted upright bass. Reverb-heavy, like playing in an empty room with rain on the windows. Bittersweet major 7th chords, around 62 BPM, gentle and reflective.';
    ambienceDirection = 'Soft rain on varied surfaces — leaves, stone, metal awnings. Water dripping from eaves into puddles with gentle plops. The rain creates a curtain of white noise, with occasional car tires hissing on wet asphalt in the distance.';
    visual = {
      background: { topColor: [60, 75, 95], bottomColor: [90, 105, 125], style: 'linear' },
      particles: {
        colors: [[150, 170, 200], [130, 150, 180], [170, 190, 210], [110, 130, 160]],
        maxCount: 250, spawnRate: 25, sizeRange: [1, 3], alphaRange: [0.3, 0.8],
        speedRange: [5, 10], direction: 'down', lifespan: [2, 5], drawStyle: 'line',
      },
      effects: {
        ripples: { active: true, color: [100, 130, 160], rate: 12 },
        lightning: { active: false, interval: [5, 15] },
        cloudNoise: { active: true, opacity: 0.1, scale: 0.004 },
        glow: { active: false, color: [0, 0, 0], intensity: 0 },
      },
      description: 'Muted blue-grey gradient with falling rain lines and ripples',
    };
  } else if (isSnowy) {
    poem = 'Silence dresses the city\nin white linen sheets\neach flake a whispered secret\nthe world becomes a held breath.';
    voice = 'ethereal_female';
    musicDirection = 'Sparse crystalline piano with enormous reverb, like notes dropping into a frozen lake. Ethereal bowed glass or sustained strings. Extremely slow, around 48 BPM, with long silences between phrases. Cold, vast, and delicate.';
    ambienceDirection = 'A muffled snowfall: the world wrapped in cotton. Snow absorbs all sound. Occasional crunch of boots on fresh powder, a distant crow call, the faint whisper of flakes landing. The silence itself is almost audible.';
    visual = {
      background: { topColor: [180, 195, 215], bottomColor: [220, 230, 245], style: 'linear' },
      particles: {
        colors: [[230, 240, 255], [210, 220, 240], [240, 245, 255], [200, 210, 230]],
        maxCount: 200, spawnRate: 15, sizeRange: [2, 8], alphaRange: [0.4, 0.9],
        speedRange: [0.5, 2.5], direction: 'down', lifespan: [5, 15], drawStyle: 'circle',
      },
      effects: {
        ripples: { active: false, color: [0, 0, 0], rate: 5 },
        lightning: { active: false, interval: [5, 15] },
        cloudNoise: { active: false, opacity: 0.08, scale: 0.003 },
        glow: { active: true, color: [220, 230, 250], intensity: 0.3 },
      },
      description: 'Cool white-blue gradient with drifting snowflake particles',
    };
  } else if (isFoggy) {
    poem = 'The city dissolves at its edges\nstreetlights wear halos of gauze\nsound travels strangely here\nas if the air itself is listening.';
    voice = 'contemplative_male';
    musicDirection = 'Blurred ambient textures — notes that bleed into each other with heavy reverb and delay. Bowed vibraphone or marimba with tape-degraded quality. Mysterious, around 55 BPM, like sound traveling through thick damp air. Disorienting and beautiful.';
    ambienceDirection = 'Dense fog muffling a city: sounds arrive distorted — a foghorn in the distance, footsteps that seem closer than they are, dripping condensation from overhead wires, muted traffic hum. Dreamlike acoustic space where nothing is quite where it seems.';
    visual = {
      background: { topColor: [160, 165, 170], bottomColor: [190, 195, 200], style: 'radial' },
      particles: {
        colors: [[200, 200, 210], [185, 185, 195], [215, 215, 225], [170, 170, 180]],
        maxCount: 100, spawnRate: 8, sizeRange: [4, 14], alphaRange: [0.08, 0.25],
        speedRange: [0.2, 0.8], direction: 'random', lifespan: [6, 16], drawStyle: 'glow',
      },
      effects: {
        ripples: { active: false, color: [0, 0, 0], rate: 5 },
        lightning: { active: false, interval: [5, 15] },
        cloudNoise: { active: true, opacity: 0.15, scale: 0.006 },
        glow: { active: true, color: [190, 190, 200], intensity: 0.5 },
      },
      description: 'Muted grey radial gradient with diffuse glow particles',
    };
  } else if (isClear) {
    poem = 'The sky opens its blue ledger\nand writes nothing but light\nthe buildings stand sharp-edged\nagainst all that empty brightness.';
    voice = 'bright_female';
    musicDirection = 'Bright acoustic guitar arpeggios over warm analog synth pads, with a gentle shaker keeping time. Open major chords, around 85 BPM, optimistic and sun-drenched — like golden hour stretching into forever.';
    ambienceDirection = 'A clear day in the city: birdsong specific to the region, a gentle breeze rustling leaves, distant children playing, the warmth almost audible in the soft hum of the air. Footsteps on sun-warmed pavement, an occasional bicycle bell.';
    visual = {
      background: { topColor: [80, 140, 220], bottomColor: [160, 200, 240], style: 'linear' },
      particles: {
        colors: [[255, 240, 200], [255, 250, 220], [240, 230, 190], [255, 245, 210]],
        maxCount: 80, spawnRate: 6, sizeRange: [2, 6], alphaRange: [0.2, 0.5],
        speedRange: [0.3, 1.5], direction: 'random', lifespan: [5, 12], drawStyle: 'glow',
      },
      effects: {
        ripples: { active: false, color: [0, 0, 0], rate: 5 },
        lightning: { active: false, interval: [5, 15] },
        cloudNoise: { active: false, opacity: 0.08, scale: 0.003 },
        glow: { active: true, color: [255, 240, 200], intensity: 0.35 },
      },
      description: 'Bright blue gradient with warm golden glow particles',
    };
  } else if (isCloudy) {
    poem = 'Grey covers grey in patient layers\nthe light is everywhere and nowhere\npigeons navigate by memory\nthe afternoon has no edges.';
    voice = 'gentle_female';
    musicDirection = 'Contemplative ambient with soft Rhodes piano, gentle cello sustained notes, and warm tape-saturated pads. Muted and cozy, around 68 BPM, like light filtering through linen curtains. Thoughtful without being sad.';
    ambienceDirection = 'An overcast afternoon: the muted hush of cloud cover pressing sound down. Pigeons cooing on a ledge, a distant tram or bus, the occasional rustle of a newspaper in the breeze. Everything feels closer, more contained, quieter than usual.';
    visual = {
      background: { topColor: [130, 140, 155], bottomColor: [170, 180, 195], style: 'linear' },
      particles: {
        colors: [[180, 190, 205], [160, 170, 185], [200, 210, 225], [145, 155, 170]],
        maxCount: 100, spawnRate: 8, sizeRange: [3, 8], alphaRange: [0.2, 0.5],
        speedRange: [0.5, 2], direction: 'random', lifespan: [5, 12], drawStyle: 'circle',
      },
      effects: {
        ripples: { active: false, color: [0, 0, 0], rate: 5 },
        lightning: { active: false, interval: [5, 15] },
        cloudNoise: { active: true, opacity: 0.1, scale: 0.004 },
        glow: { active: false, color: [0, 0, 0], intensity: 0 },
      },
      description: 'Muted blue-grey gradient with drifting cloud noise',
    };
  }

  return { poem, visual, voice, musicDirection, ambienceDirection };
}

export async function POST(request: NextRequest) {
  const guarded = await guardGenerationRequest(request, MOOD_LIMIT);
  if (guarded) return guarded;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Mood generation unavailable' },
      { status: 503 }
    );
  }

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

  const input = validateInput(body);
  if (!input) {
    return NextResponse.json(
      {
        error:
          'Invalid input. Required: city (string), temperature (number), condition (string), humidity (number), windSpeed (number), cloudCover (number)',
      },
      { status: 400 }
    );
  }

  // Generate mood profile via Claude API (fresh every visit — no caching)
  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: buildMoodSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: buildMoodUserMessage(input),
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    let rawText = textBlock ? textBlock.text.trim() : '';

    if (!rawText) {
      // No response from Claude — use fallback
      console.error('Mood generation: Empty response from Claude');
      const fallback = buildFallbackProfile(input.condition);
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
        _source: 'fallback:empty_response',
      });
    }

    // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    rawText = rawText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

    let parsed: { poem?: string; poemLocal?: string; visual?: Partial<VisualProfile>; voice?: string; fontFamily?: string; languageCode?: string; musicDirection?: string; ambienceDirection?: string };
    try {
      parsed = JSON.parse(rawText);
    } catch (parseError) {
      // Claude returned non-JSON — use fallback
      console.error('Mood generation: Failed to parse JSON:', (parseError as Error).message, 'Raw:', rawText.slice(0, 200));
      const fallback = buildFallbackProfile(input.condition);
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
        _source: 'fallback:json_parse_error',
      });
    }

    const fallback = buildFallbackProfile(input.condition);

    const poem =
      typeof parsed.poem === 'string' && parsed.poem.trim().length > 0
        ? parsed.poem.trim()
        : fallback.poem;

    const poemLocal =
      typeof parsed.poemLocal === 'string' && parsed.poemLocal.trim().length > 0
        ? parsed.poemLocal.trim()
        : poem; // Fall back to English poem if no local version

    const visual = clampVisualProfile(parsed.visual ?? {});
    const voice = validateVoicePersona(parsed.voice);
    const fontFamily = validateFont(parsed.fontFamily);
    const languageCode = typeof parsed.languageCode === 'string' && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(parsed.languageCode.trim())
      ? parsed.languageCode.trim()
      : 'en';
    const musicDirection = typeof parsed.musicDirection === 'string' && parsed.musicDirection.trim().length > 0
      ? parsed.musicDirection.trim()
      : fallback.musicDirection;
    const ambienceDirection = typeof parsed.ambienceDirection === 'string' && parsed.ambienceDirection.trim().length > 0
      ? parsed.ambienceDirection.trim()
      : fallback.ambienceDirection;

    return NextResponse.json({ poem, poemLocal, visual, voice, fontFamily, languageCode, musicDirection, ambienceDirection, cached: false, _source: 'ai' });
  } catch (err) {
    console.error('Mood generation error:', err);
    return NextResponse.json(
      { error: 'Failed to generate mood profile' },
      { status: 500 }
    );
  }
}
