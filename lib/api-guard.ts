import { NextRequest, NextResponse } from 'next/server';
import { upstashConfigured, upstashPipeline } from '@/lib/upstash';
import { reserveSpend, type SpendRoute } from '@/lib/spend-cap';
import { VISIT_TOKEN_HEADER, VISIT_TOKEN_TTL_SECONDS, verifyVisitToken } from '@/lib/visit-token';

type LimitConfig = {
  bucket: string;
  maxRequests: number;
  windowSeconds: number;
  maxBodyBytes: number;
};

type Counter = {
  count: number;
  expiresAt: number;
};

const memoryCounters = new Map<string, Counter>();
const memoryGrants = new Map<string, number>();
const memoryRounds = new Map<string, Counter>();

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super('Request body too large');
    this.name = 'RequestBodyTooLargeError';
  }
}

export class InvalidJsonError extends Error {
  constructor() {
    super('Invalid JSON');
    this.name = 'InvalidJsonError';
  }
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function tooLargeFromHeader(request: NextRequest, maxBodyBytes: number): boolean {
  const raw = request.headers.get('content-length');
  if (!raw) return false;
  const size = Number(raw);
  return Number.isFinite(size) && size > maxBodyBytes;
}

function rateLimitResponse(resetAt: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: 'Too many requests. Please try again shortly.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      },
    },
  );
}

async function checkUpstashLimit(key: string, config: LimitConfig): Promise<NextResponse | null> {
  const results = await upstashPipeline([
    ['INCR', key],
    ['EXPIRE', key, config.windowSeconds],
  ]);
  if (!results) return null;

  const count = Number(results[0]?.result ?? 1);
  if (count > config.maxRequests) {
    return rateLimitResponse(Date.now() + config.windowSeconds * 1000);
  }
  return null;
}

function checkMemoryLimit(key: string, config: LimitConfig): NextResponse | null {
  const now = Date.now();
  const current = memoryCounters.get(key);
  const counter = current && current.expiresAt > now
    ? current
    : { count: 0, expiresAt: now + config.windowSeconds * 1000 };

  counter.count += 1;
  memoryCounters.set(key, counter);

  if (counter.count > config.maxRequests) {
    return rateLimitResponse(counter.expiresAt);
  }
  return null;
}

export async function guardGenerationRequest(
  request: NextRequest,
  config: LimitConfig,
): Promise<NextResponse | null> {
  if (tooLargeFromHeader(request, config.maxBodyBytes)) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  const key = `weather-mood:${config.bucket}:${getClientIp(request)}`;
  try {
    const upstashLimit = await checkUpstashLimit(key, config);
    if (upstashLimit) return upstashLimit;
    if (upstashConfigured()) return null;
  } catch (err) {
    console.error('[rate-limit] Upstash unavailable, using memory fallback:', err);
  }

  return checkMemoryLimit(key, config);
}

/**
 * Claim the single-use grant a visit token carries for one route. The first
 * claim for a given token and route wins; any later claim is refused, so a
 * captured token cannot be replayed to make more upstream calls.
 */
export async function claimVisitGrant(visitId: string, route: string): Promise<'granted' | 'already_used'> {
  const key = `weather-mood:visit:${visitId}:${route}`;
  try {
    const results = await upstashPipeline([
      ['SET', key, 1, 'NX', 'EX', VISIT_TOKEN_TTL_SECONDS],
    ]);
    if (results) {
      return results[0]?.result === 'OK' ? 'granted' : 'already_used';
    }
  } catch (err) {
    console.error('[visit-grant] Upstash unavailable, using memory fallback:', err);
  }

  const now = Date.now();
  const expiresAt = memoryGrants.get(key);
  if (expiresAt && expiresAt > now) return 'already_used';
  memoryGrants.set(key, now + VISIT_TOKEN_TTL_SECONDS * 1000);
  return 'granted';
}

/**
 * Count one critique round against a visit token. The count lives in the same
 * store as the single-use grants and expires with the token, so a token buys
 * at most `maxRounds` critic calls however the client behaves.
 */
export async function claimCritiqueRound(
  visitId: string,
  maxRounds: number,
): Promise<{ allowed: boolean; round: number }> {
  const key = `weather-mood:visit:${visitId}:critique-rounds`;
  try {
    const results = await upstashPipeline([
      ['INCR', key],
      ['EXPIRE', key, VISIT_TOKEN_TTL_SECONDS],
    ]);
    if (results) {
      const round = Number(results[0]?.result ?? maxRounds + 1);
      return { allowed: round <= maxRounds, round };
    }
  } catch (err) {
    console.error('[critique-rounds] Upstash unavailable, using memory fallback:', err);
  }

  const now = Date.now();
  const current = memoryRounds.get(key);
  const counter = current && current.expiresAt > now
    ? current
    : { count: 0, expiresAt: now + VISIT_TOKEN_TTL_SECONDS * 1000 };
  counter.count += 1;
  memoryRounds.set(key, counter);
  return { allowed: counter.count <= maxRounds, round: counter.count };
}

/**
 * Guard for the paid audio routes: per-IP rate limit, then a valid visit
 * token, then the token's single-use grant for this route, then the daily
 * spend cap. Order matters: the cheap checks run first and the spend is only
 * reserved for a request that will actually reach the upstream API.
 */
export async function guardAudioRequest(
  request: NextRequest,
  config: LimitConfig & { bucket: SpendRoute },
): Promise<NextResponse | null> {
  const limited = await guardGenerationRequest(request, config);
  if (limited) return limited;

  const verdict = verifyVisitToken(request.headers.get(VISIT_TOKEN_HEADER));
  if (!verdict.ok) {
    if (verdict.reason === 'disabled') {
      console.error('[visit-token] VISIT_TOKEN_SECRET is not set; audio routes are disabled.');
      return NextResponse.json({ error: 'Audio generation unavailable' }, { status: 503 });
    }
    return NextResponse.json(
      { error: 'A valid visit token is required', reason: verdict.reason },
      { status: 401 },
    );
  }

  const grant = await claimVisitGrant(verdict.claims.id, config.bucket);
  if (grant === 'already_used') {
    return NextResponse.json({ error: 'This visit has already used this audio route' }, { status: 409 });
  }

  const spend = await reserveSpend(config.bucket);
  if (!spend.allowed) {
    console.warn(`[spend-cap] Daily cap reached: ${spend.spentCents}c of ${spend.capCents}c (shared=${spend.shared})`);
    return NextResponse.json({ error: 'Daily audio budget reached. Try again tomorrow.' }, { status: 503 });
  }

  return null;
}

export async function parseJsonBody(request: NextRequest, maxBodyBytes: number): Promise<unknown> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new InvalidJsonError();
  }

  if (new TextEncoder().encode(text).length > maxBodyBytes) {
    throw new RequestBodyTooLargeError();
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidJsonError();
  }
}
