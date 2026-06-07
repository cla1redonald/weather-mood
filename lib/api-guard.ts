import { NextRequest, NextResponse } from 'next/server';

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

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

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
  if (!redisUrl || !redisToken) return null;

  const response = await fetch(`${redisUrl.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, config.windowSeconds],
    ]),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Upstash rate limit failed: ${response.status}`);
  }

  const results = (await response.json()) as Array<{ result?: unknown }>;
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
    if (redisUrl && redisToken) return null;
  } catch (err) {
    console.error('[rate-limit] Upstash unavailable, using memory fallback:', err);
  }

  return checkMemoryLimit(key, config);
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
