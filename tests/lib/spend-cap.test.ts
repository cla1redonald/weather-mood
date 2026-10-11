import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTE_COST_CENTS, dailyCapCents, reserveSpend, resetMemorySpend, spendKeyFor } from '@/lib/spend-cap';

describe('daily spend cap (memory mode)', () => {
  beforeEach(() => {
    resetMemorySpend();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to $10 a day and honours the override', () => {
    expect(dailyCapCents()).toBe(1000);
    vi.stubEnv('WEATHER_MOOD_DAILY_CAP_CENTS', '250');
    expect(dailyCapCents()).toBe(250);
    vi.stubEnv('WEATHER_MOOD_DAILY_CAP_CENTS', 'nonsense');
    expect(dailyCapCents()).toBe(1000);
  });

  it('allows spend under the cap and refuses once it is crossed', async () => {
    vi.stubEnv('WEATHER_MOOD_DAILY_CAP_CENTS', String(ROUTE_COST_CENTS.music * 2));
    const now = Date.parse('2026-10-11T12:00:00Z');

    const first = await reserveSpend('music', now);
    const second = await reserveSpend('music', now);
    const third = await reserveSpend('music', now);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.spentCents).toBe(ROUTE_COST_CENTS.music * 3);
    expect(third.shared).toBe(false);
  });

  it('counts every route against the same daily total', async () => {
    const { mood, music, critique } = ROUTE_COST_CENTS;
    vi.stubEnv('WEATHER_MOOD_DAILY_CAP_CENTS', String(mood + music + critique));
    const now = Date.parse('2026-10-11T12:00:00Z');

    expect((await reserveSpend('mood', now)).allowed).toBe(true);
    expect((await reserveSpend('music', now)).allowed).toBe(true);
    expect((await reserveSpend('critique', now)).allowed).toBe(true);
    expect((await reserveSpend('narrate', now)).allowed).toBe(false);
  });

  it('starts a fresh total on a new day', async () => {
    vi.stubEnv('WEATHER_MOOD_DAILY_CAP_CENTS', '5');
    const today = Date.parse('2026-10-11T23:59:00Z');
    const tomorrow = Date.parse('2026-10-12T00:01:00Z');

    expect((await reserveSpend('music', today)).allowed).toBe(false);
    expect((await reserveSpend('sfx', tomorrow)).allowed).toBe(true);
    expect(spendKeyFor(today)).not.toBe(spendKeyFor(tomorrow));
  });
});

describe('per-visit cost', () => {
  it('reserves about 10 cents of Claude per visit: one director call and three critic rounds', () => {
    const claude = ROUTE_COST_CENTS.mood + 3 * ROUTE_COST_CENTS.critique;
    expect(claude).toBe(10);
  });

  it('keeps the default daily cap at $10', () => {
    expect(dailyCapCents()).toBe(1000);
  });
});
