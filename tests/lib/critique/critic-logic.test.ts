// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { computeVerdict, normaliseScores } from '@/lib/critique/verdict';
import { applyPatch, changedFields, mergePatches, pixelFixPatch } from '@/lib/critique/patch';
import { analysePixels } from '@/lib/critique/pixels';
import { decodeCritiqueImage } from '@/lib/critique/image';
import { buildFallbackProfile } from '@/lib/mood/fallback';
import { encode } from 'jpeg-js';

const scores = (values: [number, number, number, number, number]) => {
  const [palette, density, poemContrast, focalPoint, cityFlavour] = values.map((score) => ({ score, evidence: 'seen' }));
  return { palette, density, poemContrast, focalPoint, cityFlavour };
};

describe('verdict', () => {
  it('accepts only when every score is at least 4', () => {
    expect(computeVerdict(normaliseScores(scores([4, 4, 4, 4, 4])), [])).toBe('accept');
    expect(computeVerdict(normaliseScores(scores([5, 5, 5, 5, 3])), [])).toBe('revise');
  });

  it('revises on any pixel failure regardless of scores', () => {
    expect(computeVerdict(normaliseScores(scores([5, 5, 5, 5, 5])), ['too_dark'])).toBe('revise');
  });

  it('clamps out-of-range and non-numeric scores rather than trusting them', () => {
    const rubric = normaliseScores(scores([7.6, 0, Number.NaN, 3.4, 4.5]));
    expect(rubric.scores.palette.score).toBe(5);
    expect(rubric.scores.density.score).toBe(1);
    expect(rubric.scores.poemContrast.score).toBe(1);
    expect(rubric.scores.focalPoint.score).toBe(3);
    expect(rubric.scores.cityFlavour.score).toBe(5);
    expect(rubric.total).toBe(15);
    expect(rubric.lowest).toBe(1);
  });
});

describe('patches', () => {
  const profile = buildFallbackProfile('clear').visual;

  it('changes only the patched fields and clamps them', () => {
    const next = applyPatch(profile, { spawnRate: 80, direction: 'up' });
    expect(next.particles.spawnRate).toBe(40);
    expect(next.particles.direction).toBe('up');
    expect(next.background).toEqual(profile.background);
    expect(next.effects).toEqual(profile.effects);
  });

  it('does not mutate the profile it was given', () => {
    const before = structuredClone(profile);
    applyPatch(profile, { topColor: [1, 2, 3] });
    expect(profile).toEqual(before);
  });

  it('lets the model win where both set a field, and pixel fixes fill the rest', () => {
    const merged = mergePatches({ topColor: [10, 20, 30] }, { topColor: [90, 90, 90], bottomColor: [120, 120, 120] });
    expect(merged).toEqual({ topColor: [10, 20, 30], bottomColor: [120, 120, 120] });
    expect(changedFields(merged).sort()).toEqual(['bottomColor', 'topColor']);
  });

  it('builds a visible fix for each pixel failure', () => {
    const report = (failures: Array<'blank' | 'too_dark' | 'washed_out' | 'cluttered'>) => ({
      meanLuminance: 0, luminanceStdDev: 0, edgeDensity: 0, poemRegionLuminance: 0, failures,
    });
    const dark = pixelFixPatch(report(['too_dark']), profile);
    expect(Math.min(...dark.bottomColor!)).toBeGreaterThanOrEqual(70);

    const bright = pixelFixPatch(report(['washed_out']), profile);
    expect(bright.topColor![2]).toBeLessThan(profile.background.topColor[2]);

    const busy = pixelFixPatch(report(['cluttered']), profile);
    expect(busy.particleCount).toBeLessThan(profile.particles.maxCount);

    expect(pixelFixPatch(report([]), profile)).toEqual({});
  });
});

describe('image decoding and pixel analysis', () => {
  it('refuses a JPEG of the wrong size', () => {
    const tiny = encode({ data: new Uint8Array(16 * 16 * 4).fill(200), width: 16, height: 16 }, 80).data;
    const result = decodeCritiqueImage(`data:image/jpeg;base64,${tiny.toString('base64')}`);
    expect(result).toEqual({ ok: false, reason: 'wrong_size' });
  });

  it('refuses bytes that are not a JPEG', () => {
    const result = decodeCritiqueImage(`data:image/jpeg;base64,${Buffer.from('GIF89a....').toString('base64')}`);
    expect(result).toEqual({ ok: false, reason: 'not_jpeg' });
  });

  it('treats missing pixel data as blank', () => {
    expect(analysePixels(new Uint8Array(0), 0, 0).failures).toEqual(['blank']);
  });
});
