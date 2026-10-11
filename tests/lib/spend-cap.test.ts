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
    vi.stubEnv('WEATHER_MOOD_DAILY_CAP_CENTS', '10');
    const now = Date.parse('2026-10-11T12:00:00Z');

    expect((await reserveSpend('mood', now)).allowed).toBe(true);     // 1
    expect((await reserveSpend('music', now)).allowed).toBe(true);    // 9
    expect((await reserveSpend('narrate', now)).allowed).toBe(false); // 12
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
