import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  getCacheKey,
  getCachedMood,
  setCachedMood,
  buildMoodSystemPrompt,
  buildMoodUserMessage,
} from '@/lib/poem';
import type { MoodInput } from '@/lib/poem';
import {
  clampSoundProfile,
  clampVisualProfile,
} from '@/types/mood';
import type { SoundscapeProfile, VisualProfile } from '@/types/mood';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function validateInput(body: unknown): MoodInput | null {
  if (typeof body !== 'object' || body === null) return null;

  const { city, temperature, condition, humidity, windSpeed, cloudCover } =
    body as Record<string, unknown>;

  if (typeof city !== 'string' || city.trim().length === 0) return null;
  if (typeof temperature !== 'number' || !isFinite(temperature)) return null;
  if (typeof condition !== 'string' || condition.trim().length === 0) return null;
  if (typeof humidity !== 'number' || !isFinite(humidity)) return null;
  if (typeof windSpeed !== 'number' || !isFinite(windSpeed)) return null;
  if (typeof cloudCover !== 'number' || !isFinite(cloudCover)) return null;

  return {
    city: city.trim(),
    temperature,
    condition: condition.trim(),
    humidity,
    windSpeed,
    cloudCover,
  };
}

/**
 * Build a fallback mood profile based on the weather condition.
 * Used when Claude returns invalid JSON.
 */
function buildFallbackProfile(condition: string): {
  poem: string;
  sound: SoundscapeProfile;
  visual: VisualProfile;
} {
  const lower = condition.toLowerCase();

  const isRainy = lower.includes('rain') || lower.includes('drizzle') || lower.includes('shower');
  const isStormy = lower.includes('thunder') || lower.includes('storm');
  const isCloudy = lower.includes('cloud') || lower.includes('overcast');
  const isSnowy = lower.includes('snow') || lower.includes('sleet') || lower.includes('blizzard');
  const isClear = lower.includes('clear') || lower.includes('sunny');
  const isFoggy = lower.includes('fog') || lower.includes('mist') || lower.includes('haze');

  let poem = 'The weather wraps the city\nin its quiet, shifting cloak\nmoments pass like clouds\nabove the rooftops.';

  let sound: SoundscapeProfile = {
    tone: { frequency: 150, waveform: 'sine', gain: 0.12, harmonics: { second: 0.1, third: 0.05, waveform: 'sine' } },
    wind: { lfoRate: 1.0, lfoDepth: 0.15, lfoWaveform: 'sine', gustIntensity: 0.2 },
    filter: { cutoff: 3000, Q: 1.0, highShelfGain: -3 },
    precipitation: { active: false, noiseColor: 'pink', centerFrequency: 2000, Q: 0.5, gain: 0 },
    thunder: { active: false, intensity: 0, intervalMin: 5, intervalMax: 15 },
    master: { gain: 0.75 },
    description: 'Gentle ambient drone',
  };

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

  if (isStormy) {
    poem = 'Thunder rolls through the streets\nrain hammers the tin awnings\nlightning splits the dusk\nthe city holds its breath.';
    sound = {
      ...sound,
      tone: { frequency: 70, waveform: 'sawtooth', gain: 0.22, harmonics: { second: 0.3, third: 0.2, waveform: 'triangle' } },
      wind: { lfoRate: 3.5, lfoDepth: 0.4, lfoWaveform: 'triangle', gustIntensity: 0.8 },
      filter: { cutoff: 900, Q: 1.5, highShelfGain: -8 },
      precipitation: { active: true, noiseColor: 'brown', centerFrequency: 1200, Q: 0.8, gain: 0.2 },
      thunder: { active: true, intensity: 0.85, intervalMin: 4, intervalMax: 12 },
      master: { gain: 0.9 },
      description: 'Deep stormy drone with heavy rain and thunder',
    };
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
    sound = {
      ...sound,
      tone: { frequency: 100, waveform: 'triangle', gain: 0.12, harmonics: { second: 0.15, third: 0.08, waveform: 'sine' } },
      wind: { lfoRate: 1.5, lfoDepth: 0.2, lfoWaveform: 'sine', gustIntensity: 0.35 },
      filter: { cutoff: 2000, Q: 1.2, highShelfGain: -5 },
      precipitation: { active: true, noiseColor: 'pink', centerFrequency: 3000, Q: 0.6, gain: 0.15 },
      thunder: { active: false, intensity: 0, intervalMin: 5, intervalMax: 15 },
      master: { gain: 0.8 },
      description: 'Gentle rain with warm triangle drone',
    };
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
    sound = {
      ...sound,
      tone: { frequency: 220, waveform: 'sine', gain: 0.08, harmonics: { second: 0.05, third: 0.02, waveform: 'sine' } },
      wind: { lfoRate: 0.6, lfoDepth: 0.1, lfoWaveform: 'sine', gustIntensity: 0.15 },
      filter: { cutoff: 4500, Q: 0.8, highShelfGain: -2 },
      precipitation: { active: true, noiseColor: 'white', centerFrequency: 4500, Q: 0.3, gain: 0.06 },
      thunder: { active: false, intensity: 0, intervalMin: 5, intervalMax: 15 },
      master: { gain: 0.65 },
      description: 'Crystalline sine with soft white noise snowfall',
    };
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
    sound = {
      ...sound,
      tone: { frequency: 120, waveform: 'triangle', gain: 0.15, harmonics: { second: 0.2, third: 0.1, waveform: 'sine' } },
      wind: { lfoRate: 0.3, lfoDepth: 0.08, lfoWaveform: 'sine', gustIntensity: 0.1 },
      filter: { cutoff: 1500, Q: 1.8, highShelfGain: -7 },
      precipitation: { active: false, noiseColor: 'pink', centerFrequency: 2000, Q: 0.5, gain: 0 },
      thunder: { active: false, intensity: 0, intervalMin: 5, intervalMax: 15 },
      master: { gain: 0.7 },
      description: 'Muffled triangle drone with heavy filtering',
    };
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
    sound = {
      ...sound,
      tone: { frequency: 250, waveform: 'sine', gain: 0.1, harmonics: { second: 0.08, third: 0.04, waveform: 'sine' } },
      wind: { lfoRate: 0.5, lfoDepth: 0.1, lfoWaveform: 'sine', gustIntensity: 0.15 },
      filter: { cutoff: 5000, Q: 0.6, highShelfGain: -1 },
      precipitation: { active: false, noiseColor: 'white', centerFrequency: 4000, Q: 0.5, gain: 0 },
      thunder: { active: false, intensity: 0, intervalMin: 5, intervalMax: 15 },
      master: { gain: 0.7 },
      description: 'Clean bright sine with open filter and gentle wind',
    };
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
    sound = {
      ...sound,
      tone: { frequency: 140, waveform: 'triangle', gain: 0.13, harmonics: { second: 0.12, third: 0.06, waveform: 'sine' } },
      wind: { lfoRate: 0.8, lfoDepth: 0.12, lfoWaveform: 'sine', gustIntensity: 0.2 },
      filter: { cutoff: 2500, Q: 1.0, highShelfGain: -4 },
      precipitation: { active: false, noiseColor: 'pink', centerFrequency: 2000, Q: 0.5, gain: 0 },
      thunder: { active: false, intensity: 0, intervalMin: 5, intervalMax: 15 },
      master: { gain: 0.75 },
      description: 'Soft triangle drone with moderate filtering',
    };
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

  return { poem, sound, visual };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Mood generation unavailable' },
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
      {
        error:
          'Invalid input. Required: city (string), temperature (number), condition (string), humidity (number), windSpeed (number), cloudCover (number)',
      },
      { status: 400 }
    );
  }

  // Check cache
  const cacheKey = getCacheKey(input.city, input.condition);
  const cached = getCachedMood(cacheKey);
  if (cached) {
    return NextResponse.json({
      poem: cached.poem,
      sound: cached.sound,
      visual: cached.visual,
      cached: true,
    });
  }

  // Generate mood profile via Claude API
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
    const rawText = textBlock ? textBlock.text.trim() : '';

    if (!rawText) {
      // No response from Claude — use fallback
      const fallback = buildFallbackProfile(input.condition);
      return NextResponse.json({
        poem: fallback.poem,
        sound: fallback.sound,
        visual: fallback.visual,
        cached: false,
      });
    }

    let parsed: { poem?: string; sound?: Partial<SoundscapeProfile>; visual?: Partial<VisualProfile> };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Claude returned non-JSON — use fallback
      console.error('Mood generation: Failed to parse JSON from Claude response');
      const fallback = buildFallbackProfile(input.condition);
      return NextResponse.json({
        poem: fallback.poem,
        sound: fallback.sound,
        visual: fallback.visual,
        cached: false,
      });
    }

    const poem =
      typeof parsed.poem === 'string' && parsed.poem.trim().length > 0
        ? parsed.poem.trim()
        : buildFallbackProfile(input.condition).poem;

    const sound = clampSoundProfile(parsed.sound ?? {});
    const visual = clampVisualProfile(parsed.visual ?? {});

    setCachedMood(cacheKey, poem, sound, visual);

    return NextResponse.json({ poem, sound, visual, cached: false });
  } catch (err) {
    console.error('Mood generation error:', err);
    return NextResponse.json(
      { error: 'Failed to generate mood profile' },
      { status: 500 }
    );
  }
}
