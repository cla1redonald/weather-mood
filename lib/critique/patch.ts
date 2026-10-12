/**
 * Turn the critic's named adjustments into numbers, in code.
 *
 * The critic picks knobs from a fixed list ("warmer, large"); this module
 * decides what each knob does to the profile. Every result goes back through
 * clampVisualProfile, so no adjustment, however often repeated, can push a
 * value out of the renderer's safe range.
 *
 * The pixel checks have their own fixes (pixelFixPatch). They are server-side
 * only and are applied after the model's adjustments, so the arithmetic has
 * the last word on a frame that is black, washed out or noise.
 */
import { clampVisualProfile, type RGB, type VisualProfile } from '@/types/mood';
import {
  MAX_ADJUSTMENTS,
  isAdjustmentKnob,
  type Adjustment,
  type AdjustmentAmount,
  type AdjustmentKnob,
} from '@/lib/critique/schema';
import type { PixelFailure, PixelReport } from '@/lib/critique/pixels';

type KnobEffect = (profile: VisualProfile, amount: AdjustmentAmount) => void;

const by = (amount: AdjustmentAmount, small: number, large: number) => (amount === 'large' ? large : small);

const round2 = (value: number) => Math.round(value * 100) / 100;

function shiftColour(rgb: RGB, delta: RGB): RGB {
  return rgb.map((c, i) => Math.max(0, Math.min(255, Math.round(c + delta[i])))) as RGB;
}

function scaleColour(rgb: RGB, factor: number, offset = 0, floor = 0): RGB {
  return rgb.map((c) => Math.max(floor, Math.min(255, Math.round(c * factor + offset)))) as RGB;
}

function scaleRange(range: [number, number], factor: number): [number, number] {
  return [round2(range[0] * factor), round2(range[1] * factor)];
}

/** Shift every background and particle colour by the same RGB delta. */
function shiftPalette(profile: VisualProfile, delta: RGB): void {
  profile.background.topColor = shiftColour(profile.background.topColor, delta);
  profile.background.bottomColor = shiftColour(profile.background.bottomColor, delta);
  profile.particles.colors = profile.particles.colors.map((c) => shiftColour(c, delta)) as VisualProfile['particles']['colors'];
}

function scaleBackground(profile: VisualProfile, factor: number, offset = 0): void {
  profile.background.topColor = scaleColour(profile.background.topColor, factor, offset);
  profile.background.bottomColor = scaleColour(profile.background.bottomColor, factor, offset);
}

function scaleParticleCount(profile: VisualProfile, factor: number): void {
  profile.particles.maxCount = Math.round(profile.particles.maxCount * factor);
  profile.particles.spawnRate = Math.round(profile.particles.spawnRate * factor);
}

function brightestParticleColour(profile: VisualProfile): RGB {
  return [...profile.particles.colors].sort((a, b) => (b[0] + b[1] + b[2]) - (a[0] + a[1] + a[2]))[0];
}

// Amber is mostly red with some green; adding to R and G and taking from B
// moves any colour towards it. Cool is the mirror image.
const WARM_SMALL: RGB = [14, 6, -14];
const WARM_LARGE: RGB = [32, 14, -32];
const negate = (rgb: RGB): RGB => rgb.map((c) => -c) as RGB;

/**
 * What each knob does. Typed as a Record over every knob, so adding a knob to
 * the schema without a handler here is a type error.
 */
export const KNOB_EFFECTS: Record<AdjustmentKnob, KnobEffect> = {
  warmer: (p, amount) => shiftPalette(p, amount === 'large' ? WARM_LARGE : WARM_SMALL),
  cooler: (p, amount) => shiftPalette(p, negate(amount === 'large' ? WARM_LARGE : WARM_SMALL)),
  lighter: (p, amount) => {
    // The offset lifts near-black colours, which scaling alone cannot move.
    scaleBackground(p, by(amount, 1.15, 1.35), by(amount, 8, 20));
    p.particles.alphaRange = scaleRange(p.particles.alphaRange, by(amount, 1.15, 1.35));
  },
  darker: (p, amount) => {
    scaleBackground(p, by(amount, 0.85, 0.65));
    p.particles.alphaRange = scaleRange(p.particles.alphaRange, by(amount, 0.85, 0.65));
  },
  more_particles: (p, amount) => scaleParticleCount(p, by(amount, 1.25, 1.5)),
  fewer_particles: (p, amount) => scaleParticleCount(p, by(amount, 0.75, 0.5)),
  bigger_particles: (p, amount) => { p.particles.sizeRange = scaleRange(p.particles.sizeRange, by(amount, 1.25, 1.5)); },
  smaller_particles: (p, amount) => { p.particles.sizeRange = scaleRange(p.particles.sizeRange, by(amount, 0.75, 0.5)); },
  faster: (p, amount) => { p.particles.speedRange = scaleRange(p.particles.speedRange, by(amount, 1.25, 1.5)); },
  slower: (p, amount) => { p.particles.speedRange = scaleRange(p.particles.speedRange, by(amount, 0.75, 0.5)); },
  calmer_behind_poem: (p, amount) => {
    // Light text reads on a dark panel over a quiet, dark bottom edge.
    const factor = by(amount, 0.8, 0.6);
    p.particles.alphaRange = scaleRange(p.particles.alphaRange, factor);
    p.background.bottomColor = scaleColour(p.background.bottomColor, factor);
  },
  add_glow: (p, amount) => {
    const glow = p.effects.glow;
    glow.active = true;
    glow.intensity = round2(glow.intensity + by(amount, 0.15, 0.3));
    // A black glow draws nothing; borrow the brightest particle colour.
    if (glow.color[0] + glow.color[1] + glow.color[2] < 60) glow.color = brightestParticleColour(p);
  },
  remove_glow: (p, amount) => {
    if (amount === 'large') p.effects.glow.active = false;
    else p.effects.glow.intensity = round2(p.effects.glow.intensity * 0.5);
  },
  more_cloud: (p, amount) => {
    p.effects.cloudNoise.active = true;
    p.effects.cloudNoise.opacity = round2(p.effects.cloudNoise.opacity + by(amount, 0.03, 0.07));
  },
  less_cloud: (p, amount) => {
    if (amount === 'large') p.effects.cloudNoise.active = false;
    else p.effects.cloudNoise.opacity = round2(p.effects.cloudNoise.opacity - 0.03);
  },
  softer_particles: (p, amount) => {
    p.particles.drawStyle = 'glow';
    p.particles.alphaRange = scaleRange(p.particles.alphaRange, by(amount, 0.85, 0.7));
  },
  sharper_particles: (p, amount) => {
    p.particles.drawStyle = 'circle';
    p.particles.alphaRange = scaleRange(p.particles.alphaRange, by(amount, 1.1, 1.25));
  },
};

const OPPOSITES: Partial<Record<AdjustmentKnob, AdjustmentKnob>> = {
  warmer: 'cooler', cooler: 'warmer',
  lighter: 'darker', darker: 'lighter',
  more_particles: 'fewer_particles', fewer_particles: 'more_particles',
  bigger_particles: 'smaller_particles', smaller_particles: 'bigger_particles',
  faster: 'slower', slower: 'faster',
  add_glow: 'remove_glow', remove_glow: 'add_glow',
  more_cloud: 'less_cloud', less_cloud: 'more_cloud',
  softer_particles: 'sharper_particles', sharper_particles: 'softer_particles',
};

/**
 * The list the server will act on: known knobs only, each knob once, no knob
 * whose opposite came earlier (the list is strongest first), at most four.
 */
export function normaliseAdjustments(raw: readonly Adjustment[]): Adjustment[] {
  const kept: Adjustment[] = [];
  const seen = new Set<AdjustmentKnob>();
  for (const entry of raw) {
    if (!isAdjustmentKnob(entry?.knob) || seen.has(entry.knob)) continue;
    const opposite = OPPOSITES[entry.knob];
    if (opposite && seen.has(opposite)) continue;
    seen.add(entry.knob);
    kept.push({ knob: entry.knob, amount: entry.amount === 'large' ? 'large' : 'small' });
    if (kept.length === MAX_ADJUSTMENTS) break;
  }
  return kept;
}

export interface AdjustedProfile {
  profile: VisualProfile;
  /** The adjustments that changed at least one value, in the order applied. */
  applied: Adjustment[];
}

/**
 * Apply each adjustment in turn, clamping after every step so the next knob
 * starts from a legal profile. A knob that changes nothing (removing a glow
 * that is already off) is left out of `applied`, so the loop can tell a
 * revision from a no-op.
 */
export function adjustProfile(profile: VisualProfile, adjustments: readonly Adjustment[]): AdjustedProfile {
  let current = clampVisualProfile(structuredClone(profile));
  const applied: Adjustment[] = [];
  for (const adjustment of normaliseAdjustments(adjustments)) {
    const draft = structuredClone(current);
    KNOB_EFFECTS[adjustment.knob](draft, adjustment.amount);
    const next = clampVisualProfile(draft);
    if (JSON.stringify(next) !== JSON.stringify(current)) applied.push(adjustment);
    current = next;
  }
  return { profile: current, applied };
}

export function applyAdjustments(profile: VisualProfile, adjustments: readonly Adjustment[]): VisualProfile {
  return adjustProfile(profile, adjustments).profile;
}

/** Knob names of the adjustments, each once, in order. */
export function changedFields(adjustments: readonly Adjustment[]): AdjustmentKnob[] {
  return Array.from(new Set(adjustments.map((a) => a.knob)));
}

// ---------------------------------------------------------------------------
// Pixel-failure fixes. Server-side only: nothing here is shown to the model.

interface PixelFixPatch {
  topColor?: RGB;
  bottomColor?: RGB;
  particleAlpha?: [number, number];
  particleCount?: number;
  spawnRate?: number;
}

/** The knob each pixel fix is reported as, so `changed` stays one vocabulary. */
export const PIXEL_FIX_KNOBS: Record<PixelFailure, AdjustmentKnob> = {
  blank: 'lighter',
  too_dark: 'lighter',
  washed_out: 'darker',
  cluttered: 'fewer_particles',
};

function lift(rgb: RGB, minimum: number): RGB {
  return rgb.map((c) => Math.max(c, minimum)) as RGB;
}

/**
 * A minimal fix for each pixel failure. It makes a forced revise change
 * something visible even when the model saw nothing wrong, or never replied.
 */
export function pixelFixPatch(report: PixelReport, profile: VisualProfile): PixelFixPatch {
  const failures = new Set<PixelFailure>(report.failures);
  const patch: PixelFixPatch = {};
  const { background, particles } = profile;

  if (failures.has('too_dark') || failures.has('blank')) {
    patch.topColor = lift(scaleColour(background.topColor, 1.6), 40);
    patch.bottomColor = lift(scaleColour(background.bottomColor, 1.6), 70);
    patch.particleAlpha = [Math.max(particles.alphaRange[0], 0.35), Math.max(particles.alphaRange[1], 0.8)];
    patch.particleCount = Math.max(particles.maxCount, 150);
  }
  if (failures.has('washed_out')) {
    patch.topColor = scaleColour(background.topColor, 0.7);
    patch.bottomColor = scaleColour(background.bottomColor, 0.78);
  }
  if (failures.has('cluttered')) {
    patch.particleCount = Math.round(particles.maxCount * 0.55);
    patch.spawnRate = Math.round(particles.spawnRate * 0.55);
  }
  return patch;
}

export interface PixelFixed {
  profile: VisualProfile;
  /** Knob names standing for the fixes applied; empty when nothing failed. */
  knobs: AdjustmentKnob[];
}

export function applyPixelFixes(profile: VisualProfile, report: PixelReport): PixelFixed {
  if (report.failures.length === 0) return { profile, knobs: [] };
  const patch = pixelFixPatch(report, profile);
  const next = structuredClone(profile);
  if (patch.topColor) next.background.topColor = patch.topColor;
  if (patch.bottomColor) next.background.bottomColor = patch.bottomColor;
  if (patch.particleAlpha) next.particles.alphaRange = patch.particleAlpha;
  if (patch.particleCount !== undefined) next.particles.maxCount = patch.particleCount;
  if (patch.spawnRate !== undefined) next.particles.spawnRate = patch.spawnRate;
  return {
    profile: clampVisualProfile(next),
    knobs: Array.from(new Set(report.failures.map((failure) => PIXEL_FIX_KNOBS[failure]))),
  };
}
