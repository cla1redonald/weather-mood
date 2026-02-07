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
  soundDescription: string;
}

function validateInput(body: unknown): SfxInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const { city, condition, temperature, soundDescription } = body as Record<string, unknown>;

  if (typeof city !== 'string' || !city.trim()) return null;
  if (typeof condition !== 'string' || !condition.trim()) return null;
  if (typeof temperature !== 'number' || !isFinite(temperature)) return null;

  return {
    city: city.trim(),
    condition: condition.trim(),
    temperature,
    soundDescription: typeof soundDescription === 'string' ? soundDescription.trim() : '',
  };
}

function getCulturalAmbience(city: string): string {
  const c = city.toLowerCase();
  if (c.includes('tokyo') || c.includes('kyoto') || c.includes('osaka'))
    return 'distant train crossing bells, vending machine hums, temple wind chimes tinkling, quiet Japanese street ambiance';
  if (c.includes('paris') || c.includes('lyon'))
    return 'distant accordion fragment, café glasses clinking, cobblestone footsteps, pigeons cooing on stone ledges';
  if (c.includes('lagos') || c.includes('accra') || c.includes('nairobi'))
    return 'distant market voices and laughter, motorbike engines, tropical birds calling, vibrant street-life energy';
  if (c.includes('mumbai') || c.includes('delhi') || c.includes('kolkata'))
    return 'distant auto-rickshaw horns, chai vendor calling, temple bells ringing softly, crows in the distance';
  if (c.includes('new york'))
    return 'taxi horns in the distance, steam rising from grates, subway rumble beneath feet, fire escape pigeon flutter';
  if (c.includes('london') || c.includes('edinburgh'))
    return 'double-decker bus hiss, Big Ben-style distant chimes, pub door opening, rain on slate roofs';
  if (c.includes('rio') || c.includes('são paulo'))
    return 'distant samba drums, tropical parakeets, beach waves lapping, flip-flops on warm pavement';
  if (c.includes('istanbul') || c.includes('marrakech') || c.includes('cairo'))
    return 'distant call to prayer echo, spice market chatter, copper tray clinking, pigeons on ancient stone';
  if (c.includes('reykjavik') || c.includes('oslo') || c.includes('helsinki'))
    return 'geothermal steam hissing, arctic wind over volcanic rock, distant seabirds, almost supernatural silence';
  if (c.includes('beijing') || c.includes('shanghai'))
    return 'bicycle bells, distant erhu playing, tea pouring, bamboo rustling in courtyard wind';
  if (c.includes('havana') || c.includes('kingston'))
    return 'vintage car engine purring, domino pieces clacking, tropical birds, distant salsa from an open window';
  if (c.includes('sydney') || c.includes('melbourne'))
    return 'cockatoo calls, harbour water lapping, tram bell dinging, eucalyptus leaves rustling';
  if (c.includes('moscow') || c.includes('st. petersburg'))
    return 'church bells resonating through cold air, snow crunching underfoot, metro doors closing in the distance';
  return `ambient city sounds unique to ${city}, local atmosphere and character`;
}

function buildSfxPrompt(input: SfxInput): string {
  const lower = input.condition.toLowerCase();
  const tempDesc = input.temperature > 30 ? 'hot' :
    input.temperature > 20 ? 'warm' :
    input.temperature > 10 ? 'cool' :
    input.temperature > 0 ? 'cold' : 'freezing';

  const culturalSounds = getCulturalAmbience(input.city);
  const moodHint = input.soundDescription ? ` The overall atmosphere is ${input.soundDescription}.` : '';

  if (lower.includes('thunder') || lower.includes('storm')) {
    return `Immersive field recording: a ${tempDesc} thunderstorm in ${input.city}. Heavy tropical rain hammering on metal roofs and awnings, deep rolling thunder that shakes the chest, wind gusting and whistling through narrow streets, water rushing through gutters. In between the thunder: ${culturalSounds}.${moodHint} Cinematic and visceral.`;
  }
  if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('shower')) {
    return `Immersive field recording: ${tempDesc} rain in ${input.city}. Soft rain pattering on different surfaces — leaves, stone, metal awnings. Water dripping from eaves into puddles. The rain creates a gentle curtain of sound. Underneath: ${culturalSounds}.${moodHint} Intimate and meditative.`;
  }
  if (lower.includes('snow') || lower.includes('blizzard') || lower.includes('sleet')) {
    return `Immersive field recording: ${tempDesc} snowfall in ${input.city}. Muffled world — snow absorbs all sound. Occasional crunch of boots on fresh powder, a gentle whisper of falling flakes. The silence is almost physical. Far away: ${culturalSounds}.${moodHint} Hushed and reverent.`;
  }
  if (lower.includes('fog') || lower.includes('mist') || lower.includes('haze')) {
    return `Immersive field recording: ${tempDesc} fog in ${input.city}. Sounds travel strangely — near things sound far, far things sound near. Muffled and dreamlike. Foghorn or distant echoes. Damp air absorbing everything. Barely audible: ${culturalSounds}.${moodHint} Mysterious and disorienting.`;
  }
  if (lower.includes('wind') || lower.includes('gale')) {
    return `Immersive field recording: ${tempDesc} wind sweeping through ${input.city}. Wind whistling around building corners, loose signs creaking, leaves and debris skittering across pavement. Gusts that surge and recede. Between gusts: ${culturalSounds}.${moodHint} Restless and alive.`;
  }
  if (lower.includes('clear') || lower.includes('sunny')) {
    return `Immersive field recording: a ${tempDesc}, clear day in ${input.city}. Warm sunlight atmosphere — you can almost hear the heat. A gentle breeze carries sound from far away. Birds specific to the region. ${culturalSounds}. Footsteps on sun-warmed ground.${moodHint} Peaceful and golden.`;
  }
  if (lower.includes('cloud') || lower.includes('overcast')) {
    return `Immersive field recording: a ${tempDesc}, overcast day in ${input.city}. Subdued and grey — the cloud cover creates a quiet blanket. Sounds feel closer, more contained. ${culturalSounds}. A stillness in the air before something might happen.${moodHint} Contemplative and muted.`;
  }

  return `Immersive field recording: ${tempDesc} ${input.condition} weather in ${input.city}. ${culturalSounds}. Atmospheric, cinematic, and deeply rooted in the character of this specific place.${moodHint}`;
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
      prompt_influence: 0.75,
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
