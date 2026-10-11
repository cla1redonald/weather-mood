/**
 * A daily spend cap across every paid route. Each route reserves its estimated
 * cost before calling upstream; once the day's total passes the cap, paid
 * routes return 503 and the page falls back to parametric visuals and silence.
 *
 * Costs are estimates in US cents, deliberately rounded up. They exist to bound
 * the worst day, not to produce an invoice. Shared state lives in Upstash when
 * configured; otherwise the counter is per serverless instance, which is a
 * weaker bound and is logged as such.
 */
import { upstashPipeline } from '@/lib/upstash';

export const ROUTE_COST_CENTS = {
  mood: 1,     // one Claude call
  music: 8,    // 30 seconds of generated music
  sfx: 2,      // 10 seconds of generated ambience
  narrate: 3,  // a few hundred characters of speech
} as const;

export type SpendRoute = keyof typeof ROUTE_COST_CENTS;

const DEFAULT_DAILY_CAP_CENTS = 1000; // $10 a day
const KEY_TTL_SECONDS = 48 * 60 * 60;

const memorySpend = new Map<string, number>();
let warnedAboutMemoryFallback = false;

export function dailyCapCents(): number {
  const raw = Number(process.env.WEATHER_MOOD_DAILY_CAP_CENTS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_DAILY_CAP_CENTS;
}

export function spendKeyFor(now: number): string {
  return `weather-mood:spend:${new Date(now).toISOString().slice(0, 10)}`;
}

export interface SpendDecision {
  allowed: boolean;
  spentCents: number;
  capCents: number;
  shared: boolean;
}

export async function reserveSpend(route: SpendRoute, now = Date.now()): Promise<SpendDecision> {
  const cost = ROUTE_COST_CENTS[route];
  const capCents = dailyCapCents();
  const key = spendKeyFor(now);

  try {
    const results = await upstashPipeline([
      ['INCRBY', key, cost],
      ['EXPIRE', key, KEY_TTL_SECONDS],
    ]);
    if (results) {
      const spentCents = Number(results[0]?.result ?? cost);
      return { allowed: spentCents <= capCents, spentCents, capCents, shared: true };
    }
  } catch (err) {
    console.error('[spend-cap] Upstash unavailable, using memory fallback:', err);
  }

  if (!warnedAboutMemoryFallback) {
    warnedAboutMemoryFallback = true;
    console.warn('[spend-cap] No shared store configured; the daily cap is per instance only.');
  }
  const spentCents = (memorySpend.get(key) ?? 0) + cost;
  memorySpend.set(key, spentCents);
  return { allowed: spentCents <= capCents, spentCents, capCents, shared: false };
}

/** Test hook: clear the in-memory counter. */
export function resetMemorySpend(): void {
  memorySpend.clear();
}
