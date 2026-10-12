// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { clampVisualProfile, type VisualProfile } from '@/types/mood';
import { ADJUSTMENT_KNOBS, type AdjustmentAmount, type AdjustmentKnob } from '@/lib/critique/schema';
import { adjustProfile, applyAdjustments, changedFields, normaliseAdjustments } from '@/lib/critique/patch';

/** A profile with every value well inside its clamp range, so each knob can move it. */
const base: VisualProfile = clampVisualProfile({
  background: { topColor: [70, 90, 130], bottomColor: [120, 110, 140], style: 'linear' },
  particles: {
    colors: [[180, 170, 160], [150, 140, 130], [200, 190, 180], [120, 110, 100]],
    maxCount: 200, spawnRate: 20, sizeRange: [3, 8], alphaRange: [0.3, 0.6], speedRange: [1, 4],
    direction: 'down', lifespan: [4, 10], drawStyle: 'line',
  },
  effects: {
    ripples: { active: false, color: [0, 0, 0], rate: 5 },
    lightning: { active: false, interval: [5, 15] },
    cloudNoise: { active: true, opacity: 0.08, scale: 0.003 },
    glow: { active: true, color: [240, 180, 120], intensity: 0.4 },
  },
  description: 'test scene',
});

/** Paths of the values that differ; arrays count as one value. */
function changedPaths(a: unknown, b: unknown, prefix = ''): string[] {
  if (Array.isArray(a) || typeof a !== 'object' || a === null) {
    return JSON.stringify(a) === JSON.stringify(b) ? [] : [prefix];
  }
  return Object.keys(a).flatMap((key) =>
    changedPaths((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], prefix ? `${prefix}.${key}` : key),
  );
}

const sum = (rgb: number[]) => rgb.reduce((total, c) => total + c, 0);
const mean = (range: [number, number]) => (range[0] + range[1]) / 2;
const palette = ['background.topColor', 'background.bottomColor'];

/**
 * For each knob: the fields it may touch, a number that should move, and the
 * direction it should move in. Keyed by every knob, so a new knob without a
 * row here fails the coverage test below.
 */
const EXPECTED: Record<AdjustmentKnob, { fields: string[]; measure: (p: VisualProfile) => number; sign: 1 | -1 }> = {
  warmer: { fields: [...palette, 'particles.colors'], measure: (p) => p.background.topColor[0] - p.background.topColor[2], sign: 1 },
  cooler: { fields: [...palette, 'particles.colors'], measure: (p) => p.background.topColor[0] - p.background.topColor[2], sign: -1 },
  lighter: { fields: [...palette, 'particles.alphaRange'], measure: (p) => sum(p.background.topColor), sign: 1 },
  darker: { fields: [...palette, 'particles.alphaRange'], measure: (p) => sum(p.background.topColor), sign: -1 },
  more_particles: { fields: ['particles.maxCount', 'particles.spawnRate'], measure: (p) => p.particles.maxCount, sign: 1 },
  fewer_particles: { fields: ['particles.maxCount', 'particles.spawnRate'], measure: (p) => p.particles.maxCount, sign: -1 },
  bigger_particles: { fields: ['particles.sizeRange'], measure: (p) => mean(p.particles.sizeRange), sign: 1 },
  smaller_particles: { fields: ['particles.sizeRange'], measure: (p) => mean(p.particles.sizeRange), sign: -1 },
  faster: { fields: ['particles.speedRange'], measure: (p) => mean(p.particles.speedRange), sign: 1 },
  slower: { fields: ['particles.speedRange'], measure: (p) => mean(p.particles.speedRange), sign: -1 },
  calmer_behind_poem: {
    fields: ['background.bottomColor', 'particles.alphaRange'], measure: (p) => sum(p.background.bottomColor), sign: -1,
  },
  add_glow: {
    fields: ['effects.glow.active', 'effects.glow.intensity', 'effects.glow.color'],
    measure: (p) => (p.effects.glow.active ? p.effects.glow.intensity : 0), sign: 1,
  },
  remove_glow: {
    fields: ['effects.glow.active', 'effects.glow.intensity'],
    measure: (p) => (p.effects.glow.active ? p.effects.glow.intensity : 0), sign: -1,
  },
  more_cloud: {
    fields: ['effects.cloudNoise.active', 'effects.cloudNoise.opacity'],
    measure: (p) => (p.effects.cloudNoise.active ? p.effects.cloudNoise.opacity : 0), sign: 1,
  },
  less_cloud: {
    fields: ['effects.cloudNoise.active', 'effects.cloudNoise.opacity'],
    measure: (p) => (p.effects.cloudNoise.active ? p.effects.cloudNoise.opacity : 0), sign: -1,
  },
  softer_particles: { fields: ['particles.drawStyle', 'particles.alphaRange'], measure: (p) => mean(p.particles.alphaRange), sign: -1 },
  sharper_particles: { fields: ['particles.drawStyle', 'particles.alphaRange'], measure: (p) => mean(p.particles.alphaRange), sign: 1 },
};

const apply = (knob: AdjustmentKnob, amount: AdjustmentAmount, profile = base) => applyAdjustments(profile, [{ knob, amount }]);

describe('applyAdjustments', () => {
  it('has an expectation row for every knob', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...ADJUSTMENT_KNOBS].sort());
  });

  it.each(ADJUSTMENT_KNOBS.map((knob) => [knob]))('%s changes only its own fields', (knob) => {
    for (const amount of ['small', 'large'] as const) {
      const paths = changedPaths(base, apply(knob, amount));
      expect(paths.length).toBeGreaterThan(0);
      for (const path of paths) expect(EXPECTED[knob].fields).toContain(path);
    }
  });

  it.each(ADJUSTMENT_KNOBS.map((knob) => [knob]))('%s moves the right way, and large moves more than small', (knob) => {
    const { measure, sign } = EXPECTED[knob];
    const before = measure(base);
    const small = (measure(apply(knob, 'small')) - before) * sign;
    const large = (measure(apply(knob, 'large')) - before) * sign;
    expect(small).toBeGreaterThan(0);
    expect(large).toBeGreaterThan(small);
  });

  it.each(ADJUSTMENT_KNOBS.map((knob) => [knob]))('%s stays within the clamp limits however often it is applied', (knob) => {
    let profile = base;
    for (let i = 0; i < 12; i++) profile = apply(knob, 'large', profile);
    expect(profile).toEqual(clampVisualProfile(profile));
    expect(Number.isInteger(profile.particles.maxCount)).toBe(true);
    expect(Number.isInteger(profile.particles.spawnRate)).toBe(true);
    expect(profile.particles.maxCount).toBeGreaterThanOrEqual(50);
    expect(profile.particles.maxCount).toBeLessThanOrEqual(400);
    expect(profile.particles.alphaRange[1]).toBeLessThanOrEqual(1);
    expect(profile.effects.cloudNoise.opacity).toBeLessThanOrEqual(0.2);
  });

  it('returns an identical profile for an empty list, without mutating the input', () => {
    const before = structuredClone(base);
    expect(applyAdjustments(base, [])).toEqual(base);
    applyAdjustments(base, [{ knob: 'warmer', amount: 'large' }, { knob: 'add_glow', amount: 'large' }]);
    expect(base).toEqual(before);
  });

  it('lifts a pure black background, which scaling alone could not', () => {
    const black = { ...structuredClone(base), background: { ...base.background, topColor: [0, 0, 0] as [number, number, number] } };
    expect(sum(apply('lighter', 'small', black).background.topColor)).toBeGreaterThan(0);
  });

  it('gives a black glow a visible colour when switching it on', () => {
    const unlit = structuredClone(base);
    unlit.effects.glow = { active: false, color: [0, 0, 0], intensity: 0 };
    const lit = apply('add_glow', 'small', unlit);
    expect(lit.effects.glow.active).toBe(true);
    expect(lit.effects.glow.intensity).toBeGreaterThan(0);
    expect(sum(lit.effects.glow.color)).toBeGreaterThan(300);
  });

  it('leaves no-ops out of the applied list', () => {
    const unlit = structuredClone(base);
    unlit.effects.glow.active = false;
    const result = adjustProfile(unlit, [{ knob: 'remove_glow', amount: 'large' }, { knob: 'faster', amount: 'small' }]);
    expect(changedFields(result.applied)).toEqual(['faster']);
  });
});

describe('normaliseAdjustments', () => {
  it('keeps each knob once, drops a knob whose opposite came first, and stops at four', () => {
    const kept = normaliseAdjustments([
      { knob: 'warmer', amount: 'small' },
      { knob: 'warmer', amount: 'large' },
      { knob: 'cooler', amount: 'large' },
      { knob: 'lighter', amount: 'small' },
      { knob: 'faster', amount: 'large' },
      { knob: 'add_glow', amount: 'small' },
      { knob: 'more_cloud', amount: 'small' },
    ]);
    expect(kept).toEqual([
      { knob: 'warmer', amount: 'small' },
      { knob: 'lighter', amount: 'small' },
      { knob: 'faster', amount: 'large' },
      { knob: 'add_glow', amount: 'small' },
    ]);
  });
});
