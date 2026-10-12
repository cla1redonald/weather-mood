import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { closingNote, useSelfCritique } from '@/hooks/useSelfCritique';
import { buildFallbackProfile } from '@/lib/mood/fallback';
import type { CritiqueResponse } from '@/lib/critique/types';

const draft = buildFallbackProfile('cloudy').visual;
const weather = {
  city: 'Dunfermline', country: 'United Kingdom', temperature: 8, condition: 'overcast', humidity: 84,
  windSpeed: 18, cloudCover: 96, weatherCode: 3, windDirection: 260, uvIndex: 1,
};

function critique(round: number, overrides: Partial<CritiqueResponse> = {}): CritiqueResponse {
  return {
    round,
    maxRounds: 3,
    verdict: 'revise',
    scores: null,
    total: 12 + round,
    critique: `the grey is flat in round ${round}, adding amber`,
    defect: 'flat grey',
    evidence: 'the upper third is flat grey',
    adjustments: [{ knob: 'add_glow', amount: 'small' }],
    changed: ['add_glow'],
    profile: { ...structuredClone(draft), description: `revision ${round}` },
    pixels: { meanLuminance: 110, luminanceStdDev: 18, edgeDensity: 1, poemRegionLuminance: 120 },
    forcedBy: [],
    source: 'model',
    ...overrides,
  };
}

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

const capture = vi.fn(async () => 'data:image/jpeg;base64,AAAA');

function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  })) as typeof window.matchMedia;
}

describe('useSelfCritique', () => {
  let fetchStub: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setReducedMotion(false);
    capture.mockClear();
    fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const startArgs = (visitToken: string | null = 'visit-token') => ({
    profile: draft, weather, visitToken, getCanvas: () => null,
  });

  it('skips the loop entirely for prefers-reduced-motion', () => {
    setReducedMotion(true);
    const apply = vi.fn();
    const { result } = renderHook(() => useSelfCritique(apply, { capture }));

    act(() => result.current.start(startArgs()));

    expect(result.current.state.phase).toBe('idle');
    expect(fetchStub).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it('does not start without a visit token', () => {
    const { result } = renderHook(() => useSelfCritique(vi.fn(), { capture }));
    act(() => result.current.start(startArgs(null)));
    expect(result.current.state.phase).toBe('idle');
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('narrates each round, applies revisions, and ends with a closing note at the cap', async () => {
    fetchStub
      .mockResolvedValueOnce(okJson(critique(1)))
      .mockResolvedValueOnce(okJson(critique(2)))
      .mockResolvedValueOnce(okJson(critique(3)));
    const apply = vi.fn();
    const { result } = renderHook(() => useSelfCritique(apply, { capture }));

    act(() => result.current.start(startArgs()));
    expect(result.current.state.message).toBe('Round 1 of 3: Claude is looking at its own work');

    await waitFor(() => expect(result.current.state.phase).toBe('done'));
    expect(result.current.state.message).toBe('Round 3 of 3: the grey is flat in round 3, adding amber');
    expect(result.current.state.roundsCompleted).toBe(3);
    expect(result.current.state.note).toBe('Done after 3 rounds.');
    expect(fetchStub).toHaveBeenCalledTimes(3);
    expect(apply.mock.calls.map(([p]) => p.description)).toEqual(['revision 1', 'revision 2']);
  });

  it('rolls back on screen when the last revision scored lower, and says so', async () => {
    fetchStub
      .mockResolvedValueOnce(okJson(critique(1, { total: 20 })))
      .mockResolvedValueOnce(okJson(critique(2, { total: 11 })))
      .mockResolvedValueOnce(okJson(critique(3, { total: 13 })));
    const apply = vi.fn();
    const { result } = renderHook(() => useSelfCritique(apply, { capture }));

    act(() => result.current.start(startArgs()));
    await waitFor(() => expect(result.current.state.phase).toBe('done'));

    expect(apply).toHaveBeenLastCalledWith(draft);
    expect(result.current.state.note).toBe('Done after 3 rounds. Went back to the first draft, which scored highest.');
  });

  it('Skip stops the loop at once and hides the ticker', async () => {
    let answer: (r: Response) => void = () => {};
    fetchStub.mockImplementationOnce(() => new Promise<Response>((resolve) => { answer = resolve; }));
    const apply = vi.fn();
    const { result } = renderHook(() => useSelfCritique(apply, { capture }));

    act(() => result.current.start(startArgs()));
    await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));

    act(() => result.current.skip());
    expect(result.current.state.phase).toBe('idle');

    await act(async () => answer(okJson(critique(1))));
    expect(apply).not.toHaveBeenCalled();
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it('a city change cancels the loop without touching the canvas', async () => {
    fetchStub.mockImplementationOnce((_url: string, init: RequestInit) => new Promise<Response>((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
    }));
    const apply = vi.fn();
    const { result } = renderHook(() => useSelfCritique(apply, { capture }));

    act(() => result.current.start(startArgs()));
    await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
    act(() => result.current.cancel());

    expect(result.current.state.phase).toBe('idle');
    await act(async () => {});
    expect(apply).not.toHaveBeenCalled();
  });

  it('stops on accept with a note', async () => {
    fetchStub.mockResolvedValueOnce(okJson(critique(1, { verdict: 'accept', total: 22, changed: [], adjustments: [] })));
    const { result } = renderHook(() => useSelfCritique(vi.fn(), { capture }));

    act(() => result.current.start(startArgs()));
    await waitFor(() => expect(result.current.state.phase).toBe('done'));
    expect(result.current.state.note).toBe('Every score reached 4 out of 5 after 1 round.');
  });
});

describe('closingNote', () => {
  const base = { roundsCompleted: 2, finalProfile: draft, keptRound: 2, rolledBack: false };

  it('names the kept revision when it rolls back past the first draft', () => {
    expect(closingNote({ ...base, stop: 'budget', rolledBack: true, keptRound: 2 }))
      .toBe('Out of time after 2 rounds. Went back to the round 1 revision, which scored highest.');
  });

  it('says nothing for a skip or a cancel', () => {
    expect(closingNote({ ...base, stop: 'skipped' })).toBeNull();
    expect(closingNote({ ...base, stop: 'aborted' })).toBeNull();
  });
});
