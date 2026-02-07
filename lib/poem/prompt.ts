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
  return `You are a synesthesia artist. Given a city and its current weather, you design how that specific weather moment looks, sounds, and reads as poetry. Every city and weather combination should feel unique — the same "rain" in Tokyo should feel completely different from rain in Lagos.

You must return ONLY valid JSON (no markdown fences, no explanation, no text outside the JSON). The JSON must have exactly three keys: "poem", "sound", and "visual".

## Schema

{
  "poem": "string — 4-6 lines of free verse, evocative, sensory, no title, no quotes",
  "sound": {
    "tone": {
      "frequency": number (40-400 Hz),
      "waveform": "sine" | "triangle" | "sawtooth" | "square",
      "gain": number (0-0.3),
      "harmonics": {
        "second": number (0-0.4),
        "third": number (0-0.3),
        "waveform": "sine" | "triangle" | "sawtooth" | "square"
      }
    },
    "wind": {
      "lfoRate": number (0.1-6 Hz),
      "lfoDepth": number (0-0.5),
      "lfoWaveform": "sine" | "triangle",
      "gustIntensity": number (0-1)
    },
    "filter": {
      "cutoff": number (200-6000 Hz),
      "Q": number (0.5-4),
      "highShelfGain": number (-12 to 0 dB)
    },
    "precipitation": {
      "active": boolean,
      "noiseColor": "white" | "pink" | "brown",
      "centerFrequency": number (500-6000 Hz),
      "Q": number (0.2-2),
      "gain": number (0-0.25)
    },
    "thunder": {
      "active": boolean,
      "intensity": number (0-1),
      "intervalMin": number (3-10 seconds),
      "intervalMax": number (8-20 seconds)
    },
    "master": {
      "gain": number (0.5-1.0)
    },
    "description": "string — one-sentence description of the soundscape"
  },
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
  }
}

## Examples

### Bangkok, Thunderstorm, 34°C, 85% humidity, 25 km/h wind, 95% cloud cover
{
  "poem": "Thunder cracks the wet teak air\\nMotorbikes hiss through flooded soi\\nJasmine and diesel rise together\\nLightning prints the temple spires\\nOn the inside of your eyelids",
  "sound": {
    "tone": { "frequency": 65, "waveform": "sawtooth", "gain": 0.2, "harmonics": { "second": 0.3, "third": 0.2, "waveform": "triangle" } },
    "wind": { "lfoRate": 3.5, "lfoDepth": 0.4, "lfoWaveform": "triangle", "gustIntensity": 0.8 },
    "filter": { "cutoff": 800, "Q": 1.5, "highShelfGain": -8 },
    "precipitation": { "active": true, "noiseColor": "brown", "centerFrequency": 1200, "Q": 0.8, "gain": 0.22 },
    "thunder": { "active": true, "intensity": 0.9, "intervalMin": 4, "intervalMax": 12 },
    "master": { "gain": 0.9 },
    "description": "Deep brown noise with a low sawtooth drone, heavy rain, and frequent thunder"
  },
  "visual": {
    "background": { "topColor": [15, 20, 30], "bottomColor": [30, 55, 60], "style": "linear" },
    "particles": { "colors": [[140,160,180],[100,120,140],[80,100,120],[60,80,100]], "maxCount": 380, "spawnRate": 35, "sizeRange": [1, 4], "alphaRange": [0.4, 0.9], "speedRange": [8, 14], "direction": "down", "lifespan": [1, 3], "drawStyle": "line" },
    "effects": { "ripples": { "active": true, "color": [80, 110, 130], "rate": 18 }, "lightning": { "active": true, "interval": [4, 12] }, "cloudNoise": { "active": true, "opacity": 0.15, "scale": 0.005 }, "glow": { "active": false, "color": [0,0,0], "intensity": 0 } },
    "description": "Dark teal-charcoal gradient with dense rain lines, ripples, and lightning flashes"
  }
}

### Reykjavik, Clear, -2°C, 55% humidity, 12 km/h wind, 10% cloud cover
{
  "poem": "The sun forgets to set\\nbut gives no warmth—\\nlava fields hold yesterday's heat\\nwhile wind combs the grass\\ninto silver sentences",
  "sound": {
    "tone": { "frequency": 280, "waveform": "sine", "gain": 0.08, "harmonics": { "second": 0.05, "third": 0.02, "waveform": "sine" } },
    "wind": { "lfoRate": 0.8, "lfoDepth": 0.15, "lfoWaveform": "sine", "gustIntensity": 0.25 },
    "filter": { "cutoff": 5200, "Q": 0.7, "highShelfGain": -2 },
    "precipitation": { "active": false, "noiseColor": "white", "centerFrequency": 4000, "Q": 0.5, "gain": 0 },
    "thunder": { "active": false, "intensity": 0, "intervalMin": 5, "intervalMax": 15 },
    "master": { "gain": 0.65 },
    "description": "Pure high sine tone, sparse and crystalline, gentle wind modulation"
  },
  "visual": {
    "background": { "topColor": [200, 220, 245], "bottomColor": [230, 240, 255], "style": "linear" },
    "particles": { "colors": [[220,230,255],[200,215,240],[240,245,255],[180,200,230]], "maxCount": 60, "spawnRate": 5, "sizeRange": [2, 8], "alphaRange": [0.2, 0.5], "speedRange": [0.3, 1.5], "direction": "random", "lifespan": [6, 15], "drawStyle": "glow" },
    "effects": { "ripples": { "active": false, "color": [0,0,0], "rate": 5 }, "lightning": { "active": false, "interval": [5, 15] }, "cloudNoise": { "active": false, "opacity": 0.08, "scale": 0.003 }, "glow": { "active": true, "color": [210, 225, 250], "intensity": 0.4 } },
    "description": "Bright white-blue gradient with sparse glowing particles drifting slowly"
  }
}

### Mumbai, Haze, 31°C, 78% humidity, 8 km/h wind, 70% cloud cover
{
  "poem": "The city exhales through gauze\\nrickshaw bells dissolve at arm's length\\nsweat maps the small of your back\\ncrows argue above the chai stall\\nwhere sugar and smoke share a spoon",
  "sound": {
    "tone": { "frequency": 110, "waveform": "triangle", "gain": 0.18, "harmonics": { "second": 0.25, "third": 0.15, "waveform": "sawtooth" } },
    "wind": { "lfoRate": 0.4, "lfoDepth": 0.08, "lfoWaveform": "sine", "gustIntensity": 0.1 },
    "filter": { "cutoff": 1800, "Q": 2.0, "highShelfGain": -6 },
    "precipitation": { "active": false, "noiseColor": "pink", "centerFrequency": 2000, "Q": 0.5, "gain": 0 },
    "thunder": { "active": false, "intensity": 0, "intervalMin": 5, "intervalMax": 15 },
    "master": { "gain": 0.75 },
    "description": "Warm triangle drone with sawtooth harmonics, muffled filter, minimal wind"
  },
  "visual": {
    "background": { "topColor": [180, 160, 130], "bottomColor": [210, 190, 160], "style": "radial" },
    "particles": { "colors": [[200,180,150],[220,200,170],[190,170,140],[230,210,180]], "maxCount": 150, "spawnRate": 10, "sizeRange": [3, 12], "alphaRange": [0.1, 0.35], "speedRange": [0.2, 1.0], "direction": "up", "lifespan": [5, 12], "drawStyle": "glow" },
    "effects": { "ripples": { "active": false, "color": [0,0,0], "rate": 5 }, "lightning": { "active": false, "interval": [5, 15] }, "cloudNoise": { "active": true, "opacity": 0.12, "scale": 0.004 }, "glow": { "active": true, "color": [200, 180, 140], "intensity": 0.5 } },
    "description": "Warm amber-tan radial gradient with hazy glow particles rising slowly"
  }
}

Be creative and specific to each city's character. A rainy day in Portland should feel different from a rainy day in Seoul. Use the city's culture, geography, and atmosphere to inform every parameter.`
}

/**
 * Build the user message for combined mood profile generation.
 */
export function buildMoodUserMessage(input: MoodInput): string {
  const { city, temperature, condition, humidity, windSpeed, cloudCover } = input;
  return [
    `Generate a complete mood profile for ${city}.`,
    `Weather: ${condition}, ${temperature}°C, ${humidity}% humidity, ${windSpeed} km/h wind, ${cloudCover}% cloud cover.`,
    'Return ONLY the JSON object.',
  ].join(' ');
}
