/**
 * What the critic returns: five scores, the evidence behind the lowest one,
 * the defect it found, a sentence for the viewer, and up to four named
 * adjustments from a fixed vocabulary. The server turns each adjustment into
 * numbers (see patch.ts); the model never writes a profile value itself.
 *
 * There is no verdict field. Accept or revise is computed from the scores in
 * code (see verdict.ts), so the model cannot grade generously and then wave
 * its own work through.
 *
 * Keep this schema small. The API compiles it into a grammar, and the earlier
 * version (five nested criterion objects plus a flat patch of 18 optional
 * fields with RGB arrays and ranges) was refused on every call with "Schema is
 * too complex". So: no optional fields, no arrays of numbers, and no min, max
 * or length constraints. Ranges are enforced in code, after the reply.
 *
 * Note that the SDK's schema transform (0.133) moves `enum` into the field
 * description rather than the grammar, so the model can in principle return a
 * knob that is not on the list. The preprocess below drops such entries
 * rather than letting one stray word fail the whole reply.
 */
import { z } from 'zod';

export const RUBRIC_CRITERIA = ['palette', 'density', 'poemContrast', 'focalPoint', 'cityFlavour'] as const;
export type RubricCriterion = (typeof RUBRIC_CRITERIA)[number];

export const ADJUSTMENT_KNOBS = [
  'warmer',
  'cooler',
  'lighter',
  'darker',
  'more_particles',
  'fewer_particles',
  'bigger_particles',
  'smaller_particles',
  'faster',
  'slower',
  'calmer_behind_poem',
  'add_glow',
  'remove_glow',
  'more_cloud',
  'less_cloud',
  'softer_particles',
  'sharper_particles',
] as const;
export type AdjustmentKnob = (typeof ADJUSTMENT_KNOBS)[number];

export const ADJUSTMENT_AMOUNTS = ['small', 'large'] as const;
export type AdjustmentAmount = (typeof ADJUSTMENT_AMOUNTS)[number];

export interface Adjustment {
  knob: AdjustmentKnob;
  amount: AdjustmentAmount;
}

/** Most adjustments the server applies from one reply. Enforced in code. */
export const MAX_ADJUSTMENTS = 4;

const KNOB_SET: ReadonlySet<string> = new Set(ADJUSTMENT_KNOBS);

export function isAdjustmentKnob(value: unknown): value is AdjustmentKnob {
  return typeof value === 'string' && KNOB_SET.has(value);
}

// `type: integer` in the grammar without the safe-integer bounds `z.int()`
// would add to the description. The 1 to 5 range is clamped in verdict.ts.
const score = (question: string) => z.number().meta({ type: 'integer' }).describe(`1 to 5: ${question}`);

const AdjustmentSchema = z.object({
  knob: z.enum(ADJUSTMENT_KNOBS),
  amount: z.enum(ADJUSTMENT_AMOUNTS),
});

/** Keep only entries naming a known knob; an unknown amount reads as small. */
function keepKnownAdjustments(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .filter((entry) => isAdjustmentKnob(entry.knob))
    .map((entry) => ({ knob: entry.knob, amount: entry.amount === 'large' ? 'large' : 'small' }));
}

export const CritiqueSchema = z.object({
  scores: z.object({
    palette: score('do the colours fit the temperature and condition?'),
    density: score('is the particle field right for this weather, neither empty nor cluttered?'),
    poemContrast: score('will light text on dark glass read over the poem region?'),
    focalPoint: score('is there somewhere for the eye to rest?'),
    cityFlavour: score('does it feel like this city, not anywhere with this weather?'),
  }),
  evidence: z.string().describe('One sentence: what in the screenshot drove the lowest score.'),
  defect: z.string().describe('The most important concrete defect, or why there is none.'),
  critique: z.string().describe('One sentence for the viewer, under 110 characters, lower-case start.'),
  adjustments: z.preprocess(
    keepKnownAdjustments,
    z.array(AdjustmentSchema).describe('At most 4, strongest first. Empty if every score is 4 or more.'),
  ),
});

export type CritiqueOutput = z.infer<typeof CritiqueSchema>;
