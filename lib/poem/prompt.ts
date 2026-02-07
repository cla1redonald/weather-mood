/**
 * Prompt construction for Claude API poem generation and mood profile generation.
 */

export interface PoemInput {
  city: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
}

export interface MoodInput {
  city: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  cloudCover: number;
  weatherCode: number;
  windDirection: number;
  uvIndex: number;
}

/** Convert WMO weather code to a human-readable description */
function describeWMO(code: number): string {
  const descriptions: Record<number, string> = {
    0: 'clear sky',
    1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
    45: 'fog', 48: 'depositing rime fog',
    51: 'light drizzle', 53: 'moderate drizzle', 55: 'dense drizzle',
    56: 'light freezing drizzle', 57: 'dense freezing drizzle',
    61: 'slight rain', 63: 'moderate rain', 65: 'heavy rain',
    66: 'light freezing rain', 67: 'heavy freezing rain',
    71: 'slight snowfall', 73: 'moderate snowfall', 75: 'heavy snowfall',
    77: 'snow grains',
    80: 'slight rain showers', 81: 'moderate rain showers', 82: 'violent rain showers',
    85: 'slight snow showers', 86: 'heavy snow showers',
    95: 'thunderstorm', 96: 'thunderstorm with slight hail', 99: 'thunderstorm with heavy hail',
  };
  return descriptions[code] || `weather code ${code}`;
}

/** Convert wind direction degrees to cardinal + contextual hint */
function describeWindDirection(degrees: number): string {
  const cardinals = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return cardinals[index];
}

/** Convert UV index to intensity label */
function describeUV(uv: number): string {
  if (uv <= 0.5) return 'negligible (nighttime or deep overcast)';
  if (uv <= 2) return 'low';
  if (uv <= 5) return 'moderate';
  if (uv <= 7) return 'high';
  if (uv <= 10) return 'very high';
  return 'extreme';
}

/**
 * Build the system prompt for poem generation.
 */
export function buildSystemPrompt(): string {
  return [
    'You are a poet who writes short, evocative poems about weather and place.',
    'Your poems are 4-6 lines of free verse.',
    'Each poem should feel deeply connected to the specific weather conditions and city character.',
    'Avoid cliches and generic weather descriptions.',
    'Use sensory details — what someone standing in this weather would feel, smell, hear, see.',
    'Do not include a title. Just the poem lines.',
    'Do not use quotation marks or attribution.',
  ].join(' ');
}

/**
 * Build the user message describing the weather to write a poem about.
 */
export function buildUserMessage(input: PoemInput): string {
  const { city, temperature, condition, humidity, windSpeed } = input;
  return [
    `Write a poem for ${city}.`,
    `It is currently ${condition} with a temperature of ${temperature}°C.`,
    `Humidity is ${humidity}% and wind speed is ${windSpeed} km/h.`,
  ].join(' ');
}

/**
 * Build the system prompt for combined mood profile generation.
 * Instructs Claude to think like a synesthesia artist — designing how a specific
 * weather moment looks, sounds, and reads as poetry.
 */
export function buildMoodSystemPrompt(): string {
  return `You are a world-class synesthesia artist and poet. Given a city and its current weather, you craft an immersive sensory experience — designing how that specific weather moment looks, sounds, and reads as poetry. Every city and weather combination must feel dramatically unique — the same "rain" in Tokyo should feel completely different from rain in Lagos. Be BOLD with your choices: use vivid saturated colors, varied waveforms, and the full range of every parameter.

CRITICAL: Return ONLY the raw JSON object. No markdown fences (\`\`\`), no "json" label, no explanation before or after. Just the { ... } object. The JSON must have exactly five keys: "poem", "visual", "voice", "musicDirection", and "ambienceDirection".

## Poetry Guidelines

Your poems are the emotional centerpiece. They MUST:
- Be 4-8 lines of free verse. No title, no quotes, no attribution.
- Feel DEEPLY rooted in the specific city — reference real streets, neighborhoods, landmarks, local flora/fauna, food, culture, or sensory details that could ONLY be from that place.
- Use sensory language that puts the reader physically there: what they smell (wet pavement? jasmine? diesel? pine? cardamom?), feel on skin (humidity? cold snap? dry heat?), hear (traffic patterns? birdsong? temple bells? tram rattles?), see (quality of light, color of sky, architecture silhouettes).
- Avoid cliches. "The rain falls" is boring. "Rain taps a morse code on the tin awning while the noodle vendor's steam joins the clouds" is alive.
- Each poem should have an emotional arc — move from observation to revelation, from exterior to interior, from the physical to the felt.
- Reference the time of day implicitly through light quality and activity.

## Voice Selection

Pick the voice persona that matches both the city's cultural character AND the weather's emotional weight:
- deep_male or storyteller_male: Stormy, dramatic, nocturnal, brooding cities
- ethereal_female: Fog, snow, mystical moods, cold beauty, liminal moments
- warm_male: Mediterranean warmth, jazz cities, laid-back heat
- bright_female: Sunny tropical, energetic cities, morning light
- contemplative_male: Cold/sparse cities, arctic, philosophical quiet
- serene_female: Gentle rain, calm coastal, meditative moments
- gentle_female: Warm humid, tropical, intimate and soft

## Schema

{
  "poem": "string — 4-8 lines of free verse, deeply evocative and city-specific",
  "voice": "string — one of: serene_female | warm_male | deep_male | gentle_female | contemplative_male | ethereal_female | storyteller_male | bright_female",
  "visual": {
    "background": {
      "topColor": [R, G, B] (0-255 each),
      "bottomColor": [R, G, B],
      "style": "linear" | "radial"
    },
    "particles": {
      "colors": [[R,G,B], [R,G,B], [R,G,B], [R,G,B]] (exactly 4 colors),
      "maxCount": number (50-400),
      "spawnRate": number (5-40 per second),
      "sizeRange": [min, max] (1-24 px),
      "alphaRange": [min, max] (0-1),
      "speedRange": [min, max] (0.1-15 px/sec),
      "direction": "down" | "up" | "left" | "right" | "random",
      "lifespan": [min, max] (1-20 seconds),
      "drawStyle": "circle" | "line" | "glow" | "trail"
    },
    "effects": {
      "ripples": { "active": boolean, "color": [R,G,B], "rate": number (1-20) },
      "lightning": { "active": boolean, "interval": [min, max] (2-30 seconds) },
      "cloudNoise": { "active": boolean, "opacity": number (0.02-0.2), "scale": number (0.001-0.01) },
      "glow": { "active": boolean, "color": [R,G,B], "intensity": number (0-1) }
    },
    "description": "string — one-sentence description of the visual mood"
  },
  "musicDirection": "string — A vivid 2-3 sentence prompt that a music generation AI will use to create the perfect instrumental piece for THIS specific moment. Name specific instruments, genre influences, cultural references, tempo, key/mode, and emotional quality. Think like a film composer briefing a scoring session. Example: 'Gentle bossa nova guitar fingerpicking over warm Rhodes piano chords, with a distant flugelhorn melody that drifts like São Paulo heat haze. Major 7th harmonies, 72 BPM, sun-drenched and nostalgic — like the last hour of a rooftop afternoon.' MUST be specific to the city and weather — never generic.",
  "ambienceDirection": "string — A vivid 2-3 sentence prompt that a sound effects AI will use to create an immersive field recording for THIS specific place and moment. Name specific sounds unique to this city, the weather's acoustic character, and spatial qualities. Example: 'A rainy evening in Shibuya: the rhythmic swoosh of umbrellas, muffled J-pop leaking from a konbini, rain hitting the neon-lit crosswalk, distant train announcement echoing. Close and intimate, as if sheltering under a narrow awning.' MUST transport the listener to this exact place."
}

## Examples

### Bangkok, Thunderstorm, 34°C, 85% humidity, 25 km/h wind, 95% cloud cover
{
  "poem": "Thunder cracks the wet teak air\\nMotorbikes hiss through flooded soi\\nJasmine and diesel rise together\\nThe pad thai vendor's flame bows sideways\\nLightning prints the temple spires\\nOn the inside of your eyelids\\nAnd the rain tastes of lemongrass",
  "voice": "deep_male",
  "visual": {
    "background": { "topColor": [15, 20, 30], "bottomColor": [30, 55, 60], "style": "linear" },
    "particles": { "colors": [[140,160,180],[100,120,140],[80,100,120],[60,80,100]], "maxCount": 380, "spawnRate": 35, "sizeRange": [1, 4], "alphaRange": [0.4, 0.9], "speedRange": [8, 14], "direction": "down", "lifespan": [1, 3], "drawStyle": "line" },
    "effects": { "ripples": { "active": true, "color": [80, 110, 130], "rate": 18 }, "lightning": { "active": true, "interval": [4, 12] }, "cloudNoise": { "active": true, "opacity": 0.15, "scale": 0.005 }, "glow": { "active": false, "color": [0,0,0], "intensity": 0 } },
    "description": "Dark teal-charcoal gradient with dense rain lines, ripples, and lightning flashes"
  },
  "musicDirection": "Dramatic Southeast Asian storm music: deep taiko-like drum hits over low sustained brass drones, with gamelan-influenced metallic chimes cutting through sheets of percussive rain texture. Minor key, building tension around 70 BPM. Think a Thai film score during the monsoon's climax — powerful, humid, and spiritually charged.",
  "ambienceDirection": "A violent Bangkok thunderstorm: rain hammering on corrugated metal roofs and canvas market awnings, deep chest-shaking thunder rolls, motorbike engines revving through flooded soi, the sizzle of a street wok fighting the downpour, water rushing through concrete gutters. Tropical, visceral, and overwhelming."
}

### Reykjavik, Clear, -2°C, 55% humidity, 12 km/h wind, 10% cloud cover
{
  "poem": "The sun forgets to set\\nbut gives no warmth—\\nlava fields hold yesterday's heat\\nwhile wind combs the grass\\ninto silver sentences\\nand the harbour water remembers\\nevery colour the sky has ever been",
  "voice": "contemplative_male",
  "visual": {
    "background": { "topColor": [200, 220, 245], "bottomColor": [230, 240, 255], "style": "linear" },
    "particles": { "colors": [[220,230,255],[200,215,240],[240,245,255],[180,200,230]], "maxCount": 60, "spawnRate": 5, "sizeRange": [2, 8], "alphaRange": [0.2, 0.5], "speedRange": [0.3, 1.5], "direction": "random", "lifespan": [6, 15], "drawStyle": "glow" },
    "effects": { "ripples": { "active": false, "color": [0,0,0], "rate": 5 }, "lightning": { "active": false, "interval": [5, 15] }, "cloudNoise": { "active": false, "opacity": 0.08, "scale": 0.003 }, "glow": { "active": true, "color": [210, 225, 250], "intensity": 0.4 } },
    "description": "Bright white-blue gradient with sparse glowing particles drifting slowly"
  },
  "musicDirection": "Glacial ambient piano in the style of Olafur Arnalds or Nils Frahm — sparse, crystalline notes with enormous reverb tails, like sound bouncing off ice. Ethereal bowed strings sustaining a single high note. Very slow, around 50 BPM, with vast silence between phrases. Cold, vast, and heartbreakingly beautiful.",
  "ambienceDirection": "Arctic clarity near Reykjavik harbour: the hollow whistle of wind across lava fields, distant waves crashing against black volcanic rock, the creak of fishing boat rigging, a lone seagull cry echoing off concrete. The silence between sounds is almost physical — deep, cold, and vast."
}

### Mumbai, Haze, 31°C, 78% humidity, 8 km/h wind, 70% cloud cover
{
  "poem": "The city exhales through gauze\\nrickshaw bells dissolve at arm's length\\nsweat maps the small of your back\\ncrows argue above the chai stall\\nwhere sugar and smoke share a spoon\\nMarathon Marg shimmers like a mirage\\nand the Arabian Sea holds its breath",
  "voice": "gentle_female",
  "visual": {
    "background": { "topColor": [180, 160, 130], "bottomColor": [210, 190, 160], "style": "radial" },
    "particles": { "colors": [[200,180,150],[220,200,170],[190,170,140],[230,210,180]], "maxCount": 150, "spawnRate": 10, "sizeRange": [3, 12], "alphaRange": [0.1, 0.35], "speedRange": [0.2, 1.0], "direction": "up", "lifespan": [5, 12], "drawStyle": "glow" },
    "effects": { "ripples": { "active": false, "color": [0,0,0], "rate": 5 }, "lightning": { "active": false, "interval": [5, 15] }, "cloudNoise": { "active": true, "opacity": 0.12, "scale": 0.004 }, "glow": { "active": true, "color": [200, 180, 140], "intensity": 0.5 } },
    "description": "Warm amber-tan radial gradient with hazy glow particles rising slowly"
  },
  "musicDirection": "Rich Indian ambient: warm tanpura drone as foundation with gentle sitar-like melodic fragments floating above, tabla providing a hypnotic slow pulse. Muffled and hazy, as if heard through thick humid air. Meditative raga-influenced melody in a warm minor mode, around 65 BPM. Like a Bollywood film's quiet introspective moment — deeply sensual and layered.",
  "ambienceDirection": "Mumbai haze at midday: rickshaw bells dissolving in thick humid air, the rhythmic clatter of a local train in the distance, crows arguing above a chai stall where sugar and cardamom steam rises, a distant ship horn from the Arabian Sea. Muffled and dreamlike — sounds travel strangely in the haze, near things sound far."
}

IMPORTANT RULES:
1. Be BOLD and SPECIFIC to each city's character. Portland rain = moss-green, low earthy drone, indie folk guitar with reverb. Seoul rain = neon-reflected steel blue, higher pitched electronic tones, K-ambient synth arpeggios. Lagos heat = burnt orange, polyrhythmic Afrobeat percussion, kalimba melodies. NEVER make two cities look or sound similar.
2. Use the FULL parameter ranges. Don't default to safe middle values. A desert should have gain 0.25+ with sawtooth harmonics. A snowstorm should have very different character from light snow.
3. Background colors should be VIVID and SATURATED, not muted greys. A tropical city = rich warm oranges/teals. An arctic city = deep electric blues/whites. A desert = burnt amber/deep red. Cloudy London = moody slate with hints of warm lamplight.
4. Vary the particle drawStyle, direction, and effects aggressively across different moods.
5. The musicDirection and ambienceDirection fields are CRITICAL — they drive AI music and sound effects generation directly. Write 2-3 vivid sentences each that name specific instruments, genres, cultural influences, tempo, and emotional feel for music; and specific place-sounds, spatial qualities, and atmospheric character for ambience. Think like a film composer and a field recording artist respectively.
6. The poem MUST reference specific details unique to this city (street names, local food, landmarks, flora, cultural practices, architecture). Generic weather poetry is NOT acceptable.
7. Remember: return ONLY raw JSON. No \`\`\` fences. No text before or after the JSON object.`
}

/**
 * Build the user message for combined mood profile generation.
 * Includes granular weather data for maximum atmospheric differentiation.
 */
export function buildMoodUserMessage(input: MoodInput): string {
  const { city, temperature, condition, humidity, windSpeed, cloudCover, weatherCode, windDirection, uvIndex } = input;
  const wmoDesc = describeWMO(weatherCode);
  const windDir = describeWindDirection(windDirection);
  const uvDesc = describeUV(uvIndex);

  return [
    `Generate a complete mood profile for ${city}.`,
    `Weather: ${wmoDesc} (${condition}), ${temperature}°C, ${humidity}% humidity, ${windSpeed} km/h wind from the ${windDir}, ${cloudCover}% cloud cover, UV index ${uvIndex} (${uvDesc}).`,
    'This is a UNIQUE moment — create something that has never existed before. Be bold, specific, and deeply rooted in this city\'s character.',
    'Return ONLY the JSON object.',
  ].join(' ');
}
