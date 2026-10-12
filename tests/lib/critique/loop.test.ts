import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCritiqueLoop, SKIP_REASON, type LoopOptions } from '@/lib/critique/loop';
import { buildFallbackProfile } from '@/lib/mood/fallback';
import type { CritiqueResponse } from '@/lib/critique/types';
import type { VisualProfile } from '@/types/mood';
import { sleep } from '@/lib/critique/capture';

const v0 = buildFallbackProfile('clear').visual;
const weather = {
  city: 'Glasgow', country: 'United Kingdom', temperature: 12, condition: 'rain', humidity: 90,
  windSpeed: 30, cloudCover: 100, weatherCode: 63, windDirection: 220, uvIndex: 0,
};

/** A revised profile, tagged so tests can tell versions apart. */
function version(n: number): VisualProfile {
  return { ...structuredClone(v0), description: `version ${n}` };
}

function reply(overrides: Partial<CritiqueResponse> & { total: number | null; round: number }): CritiqueResponse {
  return {
    maxRounds: 3,
    verdict: 'revise',
    scores: null,
    critique: `critique for round ${overrides.round}`,
    defect: 'a defect',
    evidence: 'the upper third is flat grey',
    adjustments: [{ knob: 'add_glow', amount: 'small' }],
    changed: ['add_glow'],
    profile: version(overrides.round),
    pixels: { meanLuminance: 90, luminanceStdDev: 20, edgeDensity: 1, poemRegionLuminance: 90 },
    forcedBy: [],
    source: 'model',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function scriptedFetch(responses: Array<Response | ((init: RequestInit) => Promise<Response>)>) {
  const queue = [...responses];
  return vi.fn(async (_url: string, init: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error('unexpected critique call');
    if (typeof next === 'function') return next(init);
    if (init.signal?.aborted) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    return next;
  });
}

function options(fetchImpl: ReturnType<typeof scriptedFetch>, overrides: Partial<LoopOptions> = {}): LoopOptions & { apply: ReturnType<typeof vi.fn> } {
  const apply = vi.fn();
  return {
    initialProfile: v0,
    weather,
    visitToken: 'token-abc',
    capture: vi.fn(async () => 'data:image/jpeg;base64,AAAA'),
    apply,
    signal: new AbortController().signal,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    ...overrides,
  } as LoopOptions & { apply: ReturnType<typeof vi.fn> };
}

function sentBody(fetchImpl: ReturnType<typeof scriptedFetch>, call: number) {
  return JSON.parse(String(fetchImpl.mock.calls[call][1].body));
}

afterEach(() => vi.useRealTimers());

describe('runCritiqueLoop stop conditions', () => {
  it('stops on accept and leaves the canvas alone', async () => {
    const fetchImpl = scriptedFetch([jsonResponse(reply({ round: 1, total: 22, verdict: 'accept', changed: [], adjustments: [] }))]);
    const opts = options(fetchImpl);

    const result = await runCritiqueLoop(opts);

    expect(result.stop).toBe('accepted');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(opts.apply).not.toHaveBeenCalled();
    expect(result.finalProfile).toBe(v0);
  });

  it('runs at most three rounds, applying each revision, and never shows an unscored final patch', async () => {
    const fetchImpl = scriptedFetch([
      jsonResponse(reply({ round: 1, total: 12 })),
      jsonResponse(reply({ round: 2, total: 15 })),
      jsonResponse(reply({ round: 3, total: 18 })),
    ]);
    const opts = options(fetchImpl);

    const result = await runCritiqueLoop(opts);

    expect(result.stop).toBe('round_cap');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(opts.apply.mock.calls.map(([p]) => (p as VisualProfile).description)).toEqual(['version 1', 'version 2']);
    expect(result.finalProfile.description).toBe('version 2');
    expect(result.rolledBack).toBe(false);
    expect(result.keptRound).toBe(3);
  });

  it('sends the token, the round number and the profile currently on screen', async () => {
    const fetchImpl = scriptedFetch([
      jsonResponse(reply({ round: 1, total: 12 })),
      jsonResponse(reply({ round: 2, total: 22, verdict: 'accept' })),
    ]);
    await runCritiqueLoop(options(fetchImpl));

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/critique');
    expect((init.headers as Record<string, string>)['x-visit-token']).toBe('token-abc');
    expect(sentBody(fetchImpl, 0)).toMatchObject({ round: 1, profile: v0, weather, image: 'data:image/jpeg;base64,AAAA' });
    expect(sentBody(fetchImpl, 1)).toMatchObject({ round: 2, profile: { description: 'version 1' } });
  });

  it('stops at the server cap when the critique route answers 429', async () => {
    const fetchImpl = scriptedFetch([
      jsonResponse(reply({ round: 1, total: 14 })),
      jsonResponse({ error: 'used all rounds' }, 429),
    ]);
    const opts = options(fetchImpl);

    const result = await runCritiqueLoop(opts);

    expect(result.stop).toBe('round_cap');
    // Version 1 was never scored, so the loop returns to the scored draft.
    expect(result.rolledBack).toBe(true);
    expect(opts.apply).toHaveBeenLastCalledWith(v0);
  });

  it('stops when the critic asks for a revision but changes nothing', async () => {
    const fetchImpl = scriptedFetch([jsonResponse(reply({ round: 1, total: 15, changed: [], adjustments: [] }))]);
    const result = await runCritiqueLoop(options(fetchImpl));
    expect(result.stop).toBe('stalled');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('stops on a server error and keeps the best scored version', async () => {
    const fetchImpl = scriptedFetch([jsonResponse(reply({ round: 1, total: 14 })), jsonResponse({ error: 'boom' }, 502)]);
    const opts = options(fetchImpl);

    const result = await runCritiqueLoop(opts);
    expect(result.stop).toBe('error');
    expect(result.finalProfile).toBe(v0);
  });

  it('stops on the wall-clock budget, even mid-request', async () => {
    vi.useFakeTimers();
    // Never answers, but rejects on abort the way a real fetch does.
    const hanging = (init: RequestInit) => new Promise<Response>((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
    });
    const fetchImpl = scriptedFetch([jsonResponse(reply({ round: 1, total: 14 })), hanging]);
    const opts = options(fetchImpl, {
      budgetMs: 45_000,
      roundTimeoutMs: 100_000,
      capture: (signal) => sleep(3_000, signal).then(() => 'data:image/jpeg;base64,AAAA'),
    });

    const pending = runCritiqueLoop(opts);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    // The second request never answers; the budget timer must end the loop.
    await vi.advanceTimersByTimeAsync(40_000);
    const result = await Promise.race([pending, Promise.resolve('still running')]);
    expect(result).not.toBe('still running');
    expect((result as Awaited<typeof pending>).stop).toBe('budget');
  });

  it('checks the budget before starting a round', async () => {
    let clock = 0;
    const fetchImpl = scriptedFetch([jsonResponse(reply({ round: 1, total: 14 }))]);
    const opts = options(fetchImpl, {
      budgetMs: 45_000,
      now: () => clock,
      capture: vi.fn(async () => {
        clock += 46_000;
        return 'data:image/jpeg;base64,AAAA';
      }),
    });

    const result = await runCritiqueLoop(opts);
    expect(result.stop).toBe('budget');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('abandons a single request after the round timeout and keeps the budget for later rounds', async () => {
    vi.useFakeTimers();
    const hanging = (init: RequestInit) => new Promise<Response>((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
    });
    const fetchImpl = scriptedFetch([hanging]);
    const opts = options(fetchImpl, {
      budgetMs: 240_000,
      roundTimeoutMs: 5_000,
      capture: async () => 'data:image/jpeg;base64,AAAA',
    });

    const pending = runCritiqueLoop(opts);
    await vi.advanceTimersByTimeAsync(4_000);
    const early = await Promise.race([pending, Promise.resolve('still running')]);
    expect(early).toBe('still running');

    await vi.advanceTimersByTimeAsync(2_000);
    const result = await Promise.race([pending, Promise.resolve('still running')]);
    expect(result).not.toBe('still running');
    // A timed-out round ends the loop as an error, not as a spent budget.
    expect((result as Awaited<typeof pending>).stop).toBe('error');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('stops without touching the canvas when the city changes mid-round', async () => {
    const controller = new AbortController();
    const fetchImpl = scriptedFetch([
      async () => {
        controller.abort('city-changed');
        return jsonResponse(reply({ round: 1, total: 12 }));
      },
    ]);
    const opts = options(fetchImpl, { signal: controller.signal });

    const result = await runCritiqueLoop(opts);
    expect(result.stop).toBe('aborted');
    expect(opts.apply).not.toHaveBeenCalled();
  });

  it('Skip stops the loop and keeps what is on screen, without a rollback', async () => {
    const controller = new AbortController();
    const fetchImpl = scriptedFetch([
      jsonResponse(reply({ round: 1, total: 14 })),
      async () => {
        controller.abort(SKIP_REASON);
        return jsonResponse(reply({ round: 2, total: 10 }));
      },
    ]);
    const opts = options(fetchImpl, { signal: controller.signal });

    const result = await runCritiqueLoop(opts);
    expect(result.stop).toBe('skipped');
    expect(opts.apply).toHaveBeenCalledTimes(1);
    expect(result.finalProfile.description).toBe('version 1');
  });

  it('does nothing at all if aborted before it starts', async () => {
    const controller = new AbortController();
    controller.abort('city-changed');
    const fetchImpl = scriptedFetch([]);
    const result = await runCritiqueLoop(options(fetchImpl, { signal: controller.signal }));
    expect(result.stop).toBe('aborted');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('runCritiqueLoop best-of rollback', () => {
  it('rolls back to the best version when the last revision scored lower', async () => {
    const fetchImpl = scriptedFetch([
      jsonResponse(reply({ round: 1, total: 20 })), // scores the first draft
      jsonResponse(reply({ round: 2, total: 13 })), // scores version 1
      jsonResponse(reply({ round: 3, total: 16 })), // scores version 2
    ]);
    const opts = options(fetchImpl);

    const result = await runCritiqueLoop(opts);

    expect(result.rolledBack).toBe(true);
    expect(result.keptRound).toBe(1);
    expect(result.finalProfile).toBe(v0);
    expect(opts.apply).toHaveBeenLastCalledWith(v0);
  });

  it('keeps the last version when it ties the best, avoiding a needless crossfade', async () => {
    const fetchImpl = scriptedFetch([
      jsonResponse(reply({ round: 1, total: 17 })),
      jsonResponse(reply({ round: 2, total: 17 })),
      jsonResponse(reply({ round: 3, total: 17 })),
    ]);
    const opts = options(fetchImpl);

    const result = await runCritiqueLoop(opts);
    expect(result.rolledBack).toBe(false);
    expect(opts.apply).toHaveBeenCalledTimes(2);
  });

  it('never rolls back to a version that failed the pixel checks, however the model scored it', async () => {
    const fetchImpl = scriptedFetch([
      jsonResponse(reply({ round: 1, total: 25, forcedBy: ['too_dark'] })), // a black draft the model loved
      jsonResponse(reply({ round: 2, total: 14 })),
      jsonResponse(reply({ round: 3, total: 12 })),
    ]);
    const opts = options(fetchImpl);

    const result = await runCritiqueLoop(opts);
    expect(result.finalProfile.description).toBe('version 1');
    expect(result.keptRound).toBe(2);
  });
});
