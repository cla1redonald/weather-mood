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
  const tempC = Math.round(input.temperature);
  const lower = input.condition.toLowerCase();

  // Derive a culturally-aware musical direction from the city name
  const cityLower = input.city.toLowerCase();
  let culturalHint = '';
  if (cityLower.includes('tokyo') || cityLower.includes('kyoto') || cityLower.includes('osaka')) {
    culturalHint = 'Use delicate koto-like plucking, ambient piano, and subtle pentatonic melodies. Think Ryuichi Sakamoto meets field recordings.';
  } else if (cityLower.includes('paris') || cityLower.includes('lyon') || cityLower.includes('marseille')) {
    culturalHint = 'Use warm accordion textures, gentle café jazz piano, and brushed snare. Think Erik Satie meets Parisian café ambiance.';
  } else if (cityLower.includes('lagos') || cityLower.includes('accra') || cityLower.includes('nairobi') || cityLower.includes('kinshasa')) {
    culturalHint = 'Use warm polyrhythmic percussion, kalimba-like tones, and flowing basslines. Think Afrobeat-influenced ambient with organic warmth.';
  } else if (cityLower.includes('rio') || cityLower.includes('são paulo') || cityLower.includes('salvador') || cityLower.includes('buenos aires')) {
    culturalHint = 'Use bossa nova guitar fingerpicking, soft nylon strings, and gentle samba-influenced rhythms. Warm and sun-drenched.';
  } else if (cityLower.includes('new york') || cityLower.includes('chicago') || cityLower.includes('new orleans')) {
    culturalHint = 'Use smoky jazz piano, muted trumpet, and upright bass. Think late-night jazz club, cinematic and urban.';
  } else if (cityLower.includes('london') || cityLower.includes('dublin') || cityLower.includes('edinburgh')) {
    culturalHint = 'Use atmospheric strings, gentle cello, and ambient piano. Think Radiohead-era melancholy, grey-sky beauty.';
  } else if (cityLower.includes('mumbai') || cityLower.includes('delhi') || cityLower.includes('kolkata') || cityLower.includes('chennai') || cityLower.includes('bangalore')) {
    culturalHint = 'Use sitar-like drones, tabla-influenced rhythms, and warm tanpura textures. Rich, meditative, and deeply layered.';
  } else if (cityLower.includes('beijing') || cityLower.includes('shanghai') || cityLower.includes('hong kong')) {
    culturalHint = 'Use guzheng-like arpeggios, bamboo flute textures, and ambient erhu-like sustained tones. Contemplative and flowing.';
  } else if (cityLower.includes('istanbul') || cityLower.includes('marrakech') || cityLower.includes('cairo') || cityLower.includes('tehran')) {
    culturalHint = 'Use oud-like plucking, modal scales, gentle darbuka rhythms, and reverb-heavy strings. Warm, ancient, and evocative.';
  } else if (cityLower.includes('reykjavik') || cityLower.includes('oslo') || cityLower.includes('helsinki') || cityLower.includes('copenhagen') || cityLower.includes('stockholm')) {
    culturalHint = 'Use glacial ambient textures, sparse piano, and ethereal pads. Think Sigur Rós or Ólafur Arnalds — vast, cold, and beautiful.';
  } else if (cityLower.includes('moscow') || cityLower.includes('st. petersburg') || cityLower.includes('saint petersburg')) {
    culturalHint = 'Use deep cello, melancholic piano, and orchestral strings. Think Tchaikovsky meets modern ambient — grand and emotionally vast.';
  } else if (cityLower.includes('havana') || cityLower.includes('kingston') || cityLower.includes('san juan')) {
    culturalHint = 'Use tropical percussion, warm brass textures, and swaying rhythms. Caribbean warmth with laid-back groove.';
  } else if (cityLower.includes('sydney') || cityLower.includes('melbourne') || cityLower.includes('auckland')) {
    culturalHint = 'Use shimmering reverb guitars, gentle didgeridoo-like drones, and open atmospheric pads. Expansive and sunlit.';
  } else {
    culturalHint = 'Use instrumentation and musical textures that evoke the cultural character and geography of this specific place.';
  }

  // Weather-driven mood and tempo guidance
  let weatherMood = '';
  if (lower.includes('thunder') || lower.includes('storm')) {
    weatherMood = 'Dramatic and building. Use minor keys, deep bass swells, and tension. Tempo around 70-80 BPM. Let it breathe and rumble.';
  } else if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('shower')) {
    weatherMood = 'Melancholic but beautiful. Gentle and reflective. Tempo around 60-70 BPM. Use reverb-heavy, intimate sounds.';
  } else if (lower.includes('snow') || lower.includes('blizzard') || lower.includes('sleet')) {
    weatherMood = 'Hushed and crystalline. Very sparse, lots of silence between notes. Tempo around 50-60 BPM. Cold beauty.';
  } else if (lower.includes('fog') || lower.includes('mist') || lower.includes('haze')) {
    weatherMood = 'Mysterious and diffuse. Blurred textures, notes bleeding into each other. Tempo around 55-65 BPM. Dreamy and uncertain.';
  } else if (lower.includes('wind') || lower.includes('gale')) {
    weatherMood = 'Restless and sweeping. Dynamic volume changes, rising and falling. Tempo around 75-90 BPM. Movement and energy.';
  } else if (lower.includes('clear') || lower.includes('sunny')) {
    if (tempC > 30) {
      weatherMood = 'Warm and languid. Slow, relaxed groove. Tempo around 65-75 BPM. Sunbaked and hazy with heat.';
    } else if (tempC > 15) {
      weatherMood = 'Bright and uplifting. Open major-key feel. Tempo around 80-100 BPM. Optimistic and gently joyful.';
    } else {
      weatherMood = 'Crisp and clear. Sharp, defined notes with space between them. Tempo around 70-80 BPM. Clean winter sunlight.';
    }
  } else if (lower.includes('cloud') || lower.includes('overcast')) {
    weatherMood = 'Contemplative and soft. Muted warmth, like light through curtains. Tempo around 60-75 BPM. Thoughtful and still.';
  } else {
    weatherMood = 'Atmospheric and evocative. Match the energy to the weather conditions. Melodic, not drony.';
  }

  return [
    `Create a beautiful, melodic instrumental piece for ${input.city} in ${input.condition} weather at ${tempC}°C.`,
    culturalHint,
    weatherMood,
    input.soundDescription ? `The atmosphere is: ${input.soundDescription}.` : '',
    `This music accompanies the following poem — match its emotional arc:`,
    `"${input.poem}"`,
    'IMPORTANT: This must be MELODIC and MUSICAL — use real instruments, harmonies, and memorable phrases.',
    'It should NOT sound like a drone, a soundscape, or white noise. It should be a piece of music someone would want to listen to.',
    'Make it evolve: introduce elements gradually, build to a gentle peak, and resolve. Cinematic and emotionally moving.',
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
