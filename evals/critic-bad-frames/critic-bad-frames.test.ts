// @vitest-environment node
/**
 * Runs the offline eval in CI, and exercises the live path against a stubbed
 * client so the code the merger will run for real has at least been executed.
 */
import { describe, expect, it } from 'vitest';
import { costCents, liveCases, runLiveEval, runOfflineEval } from './evaluate';
import { FRAME_CASES } from './frames';
import { stubAnthropic } from '../../tests/helpers/anthropic-stub';

describe('critic bad frames, offline', () => {
  const results = runOfflineEval();

  it.each(results.map((r) => [r.id, r]))('%s gets its expected pixel verdict', (_id, result) => {
    expect(result.actual).toBe(result.expected);
  });

  it('covers the four bad frames, the good frame and three controls', () => {
    expect(FRAME_CASES.filter((c) => c.expectedVerdict === 'revise')).toHaveLength(4);
    expect(FRAME_CASES.filter((c) => c.expectedVerdict === 'accept')).toHaveLength(1);
    expect(FRAME_CASES.filter((c) => c.expectedVerdict === null)).toHaveLength(3);
  });

  it('every frame fits under the 150 KB cap the way the browser encodes it', () => {
    for (const r of results) expect(r.jpegKb).toBeLessThanOrEqual(150);
  });
});

describe('critic bad frames, live path with a stubbed client', () => {
  it('computes verdicts from scores and pixel checks, and prices the usage', async () => {
    const scores = (n: number) => Object.fromEntries(
      ['palette', 'density', 'poemContrast', 'focalPoint', 'cityFlavour'].map((k) => [k, { evidence: 'seen', score: n }]),
    );
    const reply = (n: number) => ({
      text: JSON.stringify({ scores: scores(n), defect: 'none', critique: 'fine as it is', patch: {} }),
      usage: { input_tokens: 3400, output_tokens: 1000 },
    });
    // The model likes everything: only the pixel checks can catch the bad frames.
    const stub = stubAnthropic(liveCases().map(() => reply(5)));

    const results = await runLiveEval(stub.client);

    expect(results).toHaveLength(5);
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));
    expect(byId['all-black'].actual).toBe('revise');
    expect(byId['white-on-white'].actual).toBe('revise');
    expect(byId['over-dense-clutter'].actual).toBe('revise');
    expect(byId['good-dusk'].actual).toBe('accept');
    expect(costCents(results)).toBeCloseTo(5 * 1.68, 5);
  });
});
