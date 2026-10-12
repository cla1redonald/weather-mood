/**
 * What the critic returns: a scored rubric, a sentence for the viewer, the
 * defect it found, and a patch of only the fields it would change.
 *
 * There is no verdict field. Accept or revise is computed from the scores in
 * code (see verdict.ts), so the model cannot grade generously and then wave
 * its own work through.
 *
 * The patch is flat and every field is optional. Flat keeps the grammar small
 * and makes "change only these" easy to apply; nested optional objects would
 * multiply the optional properties for no gain.
 */
import { z } from 'zod';

export const RUBRIC_CRITERIA = ['palette', 'density', 'poemContrast', 'focalPoint', 'cityFlavour'] as const;
export type RubricCriterion = (typeof RUBRIC_CRITERIA)[number];

const criterion = (question: string) =>
  z.object({
    evidence: z.string().describe(`One sentence on what you see in this screenshot that answers: ${question}`),
    score: z.number().describe('1 to 5. 5: would not change it. 4: a small issue nobody would notice. 3 or below: a viewer would notice.'),
  });

const rgb = z.array(z.number()).describe('[R, G, B], each 0 to 255');
const range = (what: string) => z.array(z.number()).describe(`[min, max] ${what}`);

export const ProfilePatchSchema = z.object({
  topColor: rgb.optional(),
  bottomColor: rgb.optional(),
  gradientStyle: z.enum(['linear', 'radial']).optional(),
  particleColors: z.array(rgb).describe('exactly 4 colours').optional(),
  particleCount: z.number().describe('maxCount, 50 to 400').optional(),
  spawnRate: z.number().describe('5 to 40 per second').optional(),
  particleSize: range('1 to 24 px').optional(),
  particleAlpha: range('0 to 1').optional(),
  particleSpeed: range('0.1 to 15 px per second').optional(),
  direction: z.enum(['down', 'up', 'left', 'right', 'random']).optional(),
  drawStyle: z.enum(['circle', 'line', 'glow', 'trail']).optional(),
  glowActive: z.boolean().optional(),
  glowColor: rgb.optional(),
  glowIntensity: z.number().describe('0 to 1').optional(),
  cloudNoiseActive: z.boolean().optional(),
  cloudNoiseOpacity: z.number().describe('0.02 to 0.2').optional(),
  ripplesActive: z.boolean().optional(),
  lightningActive: z.boolean().optional(),
});

export type ProfilePatch = z.infer<typeof ProfilePatchSchema>;

export const CritiqueSchema = z.object({
  scores: z.object({
    palette: criterion('do the colours match the temperature and the condition?'),
    density: criterion('is the particle field the right amount for this weather, neither empty nor cluttered?'),
    poemContrast: criterion('will light text on a dark glass panel read clearly over the poem region?'),
    focalPoint: criterion('is there somewhere for the eye to rest?'),
    cityFlavour: criterion('does anything make this feel like this city rather than anywhere with this weather?'),
  }),
  defect: z.string().describe('The most important concrete defect, located in the frame or tied to a profile value; or, if there is none, why each criterion holds up.'),
  critique: z.string().describe('One sentence for the viewer, under 110 characters, starting lower case: what feels off and what you are changing.'),
  patch: ProfilePatchSchema.describe('Only the fields you would change. Leave out everything else.'),
});

export type CritiqueOutput = z.infer<typeof CritiqueSchema>;
