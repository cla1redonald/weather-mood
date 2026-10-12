/**
 * The zod schema for the director's whole reply. Structured outputs constrain
 * Claude to this shape, so the old fence-stripping and JSON.parse are gone.
 *
 * Numeric ranges and array lengths are stated in descriptions, not as zod
 * constraints: the API does not enforce `minimum`/`maximum` or tuple lengths,
 * and the SDK would turn a single out-of-range number into a parse failure
 * that throws away a good poem. `clampVisualProfile` enforces the ranges after
 * parsing instead, which is also the defence if the schema ever drifts.
 *
 * Enums carry `.catch()` for the same reason. The SDK's schema transform
 * (0.133) moves `enum` into the field description rather than sending it as a
 * grammar constraint, so the model is told the options but not forced to pick
 * one. One off-list voice should cost that field, not the whole reply.
 */
import { z } from 'zod';
import { DEFAULT_FONT, VALID_FONTS } from '@/lib/fonts';

export const VOICE_PERSONAS = [
  'serene_female', 'warm_male', 'deep_male', 'gentle_female',
  'contemplative_male', 'ethereal_female', 'storyteller_male', 'bright_female',
] as const;

export type VoicePersona = (typeof VOICE_PERSONAS)[number];

const rgb = z.array(z.number()).describe('[R, G, B], each 0 to 255');
const range = (what: string) => z.array(z.number()).describe(`[min, max] ${what}`);

export const VisualProfileSchema = z.object({
  background: z.object({
    topColor: rgb,
    bottomColor: rgb,
    style: z.enum(['linear', 'radial']).catch('linear'),
  }),
  particles: z.object({
    colors: z.array(rgb).describe('exactly 4 colours'),
    maxCount: z.number().describe('50 to 400'),
    spawnRate: z.number().describe('5 to 40 per second'),
    sizeRange: range('1 to 24 px'),
    alphaRange: range('0 to 1'),
    speedRange: range('0.1 to 15 px per second'),
    direction: z.enum(['down', 'up', 'left', 'right', 'random']).catch('down'),
    lifespan: range('1 to 20 seconds'),
    drawStyle: z.enum(['circle', 'line', 'glow', 'trail']).catch('circle'),
  }),
  effects: z.object({
    ripples: z.object({
      active: z.boolean(),
      color: rgb,
      rate: z.number().describe('1 to 20'),
    }),
    lightning: z.object({
      active: z.boolean(),
      interval: range('2 to 30 seconds'),
    }),
    cloudNoise: z.object({
      active: z.boolean(),
      opacity: z.number().describe('0.02 to 0.2'),
      scale: z.number().describe('0.001 to 0.01'),
    }),
    glow: z.object({
      active: z.boolean(),
      color: rgb,
      intensity: z.number().describe('0 to 1'),
    }),
  }),
  description: z.string().describe('one sentence describing the visual mood'),
});

export const MoodSchema = z.object({
  poem: z.string().describe('4 to 6 lines of free verse in English, separated by \\n'),
  poemLocal: z.string().describe('the same poem in the city\'s local language; identical to poem for English-speaking cities'),
  visual: VisualProfileSchema,
  voice: z.enum(VOICE_PERSONAS).catch('serene_female'),
  fontFamily: z.enum(VALID_FONTS as [string, ...string[]]).catch(DEFAULT_FONT),
  languageCode: z.string().describe('BCP-47 code of the poemLocal language, e.g. fr, ja, pt, en'),
  musicDirection: z.string().describe('2 to 3 sentences briefing a music generation model'),
  ambienceDirection: z.string().describe('1 to 2 sentences, at most 250 characters, briefing a sound effects model'),
});

export type MoodOutput = z.infer<typeof MoodSchema>;
