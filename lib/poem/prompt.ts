/**
 * Prompt construction for Claude API poem generation.
 */

export interface PoemInput {
  city: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
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
