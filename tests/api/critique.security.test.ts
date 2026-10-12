// @vitest-environment node
/**
 * Cost-amplification tests for /api/critique. Each test proves one limit holds
 * before the model is reached: the model call count is the thing measured.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFallbackProfile } from '@/lib/mood/fallback';
import { MAX_CRITIQUE_IMAGE_BYTES } from '@/lib/critique/limits';
import { frameCase, frameToDataUrl } from '../../evals/critic-bad-frames/frames';
import { criticReplyText, stubAnthropic, type StubReply } from '../helpers/anthropic-stub';

vi.mock('@/lib/claude/client', () => ({ createAnthropicClient: vi.fn() }));

const goodFrame = frameToDataUrl(frameCase('good-dusk').render());
const profile = buildFallbackProfile('clear').visual;
const weather = {
  city: 'Edinburgh', country: 'United Kingdom', temperature: 9, condition: 'overcast', humidity: 81,
  windSpeed: 22, cloudCover: 95, weatherCode: 3, windDirection: 250, uvIndex: 1,
};

const criticText = criticReplyText({
  score: 3,
  defect: 'The sky is one flat slate band.',
  critique: 'the slate sky is flat, adding a warm lamplight glow',
  adjustments: [{ knob: 'add_glow', amount: 'small' }],
});

function replies(count: number): StubReply[] {
  return Array.from({ length: count }, () => ({ text: criticText }));
}

let ipCounter = 0;
function uniqueIp(): string {
  ipCounter += 1;
  return `203.0.113.${(ipCounter % 250) + 1}`;
}

function critiqueRequest(options: {
  token?: string | null;
  ip?: string;
  image?: string;
  rawBody?: string;
  headers?: Record<string, string>;
}) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-for': options.ip ?? uniqueIp(),
    ...options.headers,
  };
  if (options.token) headers['x-visit-token'] = options.token;
  return new NextRequest('https://weather-mood.test/api/critique', {
    method: 'POST',
    headers,
    body: options.rawBody ?? JSON.stringify({ image: options.image ?? goodFrame, profile, weather, round: 1 }),
  });
}

function tokenId(token: string): string {
  return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')).id;
}

async function loadRoute() {
  const route = await import('@/app/api/critique/route');
  const client = await import('@/lib/claude/client');
  const tokens = await import('@/lib/visit-token');
  const spend = await import('@/lib/spend-cap');
  return { POST: route.POST, createAnthropicClient: vi.mocked(client.createAnthropicClient), ...tokens, ...spend };
}

describe('critique cost limits, memory store (Upstash not configured)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('KV_REST_API_URL', '');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('four concurrent critiques on one token reach the model at most three times', async () => {
    const { POST, createAnthropicClient, issueVisitToken } = await loadRoute();
    const stub = stubAnthropic(replies(4));
    createAnthropicClient.mockReturnValue(stub.client);
    const token = issueVisitToken()!;
    const ip = uniqueIp();

    const responses = await Promise.all([1, 2, 3, 4].map(() => POST(critiqueRequest({ token, ip }))));
    const statuses = responses.map((r) => r.status).sort();

    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(stub.fetch).toHaveBeenCalledTimes(3);
  });

  it('reserves spend before the model call: a cap refusal returns 503 with no model call', async () => {
    vi.stubEnv('WEATHER_MOOD_DAILY_CAP_CENTS', '2'); // room for exactly one critique
    const { POST, createAnthropicClient, issueVisitToken } = await loadRoute();
    const stub = stubAnthropic(replies(2));
    createAnthropicClient.mockReturnValue(stub.client);

    const first = await POST(critiqueRequest({ token: issueVisitToken()! }));
    expect(first.status).toBe(200);
    const second = await POST(critiqueRequest({ token: issueVisitToken()! }));
    expect(second.status).toBe(503);
    expect(stub.fetch).toHaveBeenCalledTimes(1);
  });

  it('charges 2 cents per critique against the daily cap', async () => {
    const { ROUTE_COST_CENTS } = await loadRoute();
    expect(ROUTE_COST_CENTS.critique).toBe(2);
  });

  it('per-IP burst limit: the 13th critique from one address in ten minutes gets 429 without a model call', async () => {
    const { POST, createAnthropicClient, issueVisitToken } = await loadRoute();
    const stub = stubAnthropic(replies(13));
    createAnthropicClient.mockReturnValue(stub.client);
    const ip = uniqueIp();

    for (let i = 0; i < 12; i++) {
      expect((await POST(critiqueRequest({ token: issueVisitToken()!, ip }))).status).toBe(200);
    }
    const blocked = await POST(critiqueRequest({ token: issueVisitToken()!, ip }));
    expect(blocked.status).toBe(429);
    expect(stub.fetch).toHaveBeenCalledTimes(12);
  });

  it('per-IP daily limit: one address gets at most 36 critiques a day across burst windows', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T08:00:00Z'));
    const { POST, createAnthropicClient, issueVisitToken } = await loadRoute();
    const stub = stubAnthropic(replies(40));
    createAnthropicClient.mockReturnValue(stub.client);
    const ip = uniqueIp();

    let served = 0;
    for (let window = 0; window < 4; window++) {
      for (let i = 0; i < 12; i++) {
        const response = await POST(critiqueRequest({ token: issueVisitToken()!, ip }));
        if (response.status === 200) served += 1;
      }
      vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    }

    expect(served).toBe(36);
    expect(stub.fetch).toHaveBeenCalledTimes(36);
  });

  it('a lying content-length cannot get an oversized body past the byte cap', async () => {
    const { POST, createAnthropicClient, issueVisitToken } = await loadRoute();
    const stub = stubAnthropic([]);
    createAnthropicClient.mockReturnValue(stub.client);
    const huge = JSON.stringify({ image: `data:image/jpeg;base64,${'A'.repeat(400 * 1024)}`, profile, weather, round: 1 });

    const response = await POST(critiqueRequest({ token: issueVisitToken()!, rawBody: huge, headers: { 'content-length': '200' } }));
    expect(response.status).toBe(413);
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it('checks the image cap on the decoded bytes, even when the body is under the body limit', async () => {
    const { POST, createAnthropicClient, issueVisitToken } = await loadRoute();
    const stub = stubAnthropic([]);
    createAnthropicClient.mockReturnValue(stub.client);
    const bytes = Buffer.alloc(MAX_CRITIQUE_IMAGE_BYTES + 1024, 1);
    bytes[0] = 0xff; bytes[1] = 0xd8; bytes[2] = 0xff;

    const response = await POST(critiqueRequest({ token: issueVisitToken()!, image: `data:image/jpeg;base64,${bytes.toString('base64')}` }));
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/Image larger than 150 KB/) });
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it('verifies the token first: a tokenless flood neither reaches the model nor uses up the address\'s limit', async () => {
    const { POST, createAnthropicClient, issueVisitToken } = await loadRoute();
    const stub = stubAnthropic(replies(1));
    createAnthropicClient.mockReturnValue(stub.client);
    const ip = uniqueIp();

    for (let i = 0; i < 20; i++) {
      expect((await POST(critiqueRequest({ token: null, ip }))).status).toBe(401);
    }
    expect((await POST(critiqueRequest({ token: issueVisitToken()!, ip }))).status).toBe(200);
    expect(stub.fetch).toHaveBeenCalledTimes(1);
  });

  it('refuses an expired token even though a round counter exists for it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T08:00:00Z'));
    const { POST, createAnthropicClient, issueVisitToken } = await loadRoute();
    const stub = stubAnthropic(replies(2));
    createAnthropicClient.mockReturnValue(stub.client);
    const token = issueVisitToken()!;

    expect((await POST(critiqueRequest({ token }))).status).toBe(200);

    vi.setSystemTime(Date.now() + 16 * 60 * 1000); // token lifetime is 15 minutes
    const late = await POST(critiqueRequest({ token }));
    expect(late.status).toBe(401);
    await expect(late.json()).resolves.toMatchObject({ reason: 'expired' });
    expect(stub.fetch).toHaveBeenCalledTimes(1);
  });

  it('refuses a token whose signature does not match, whatever id it claims', async () => {
    const { POST, createAnthropicClient, issueVisitToken } = await loadRoute();
    const stub = stubAnthropic([]);
    createAnthropicClient.mockReturnValue(stub.client);
    const [payload] = issueVisitToken()!.split('.');

    const response = await POST(critiqueRequest({ token: `${payload}.forged-signature` }));
    expect(response.status).toBe(401);
    expect(stub.fetch).not.toHaveBeenCalled();
  });
});

describe('critique cost limits, shared Upstash store', () => {
  let store: Map<string, number>;
  let commands: Array<Array<string | number>>;
  let failRoundKeys: boolean;

  beforeEach(() => {
    vi.resetModules();
    store = new Map();
    commands = [];
    failRoundKeys = false;
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake-upstash.test');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-upstash-credential');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // A fake Upstash REST pipeline. Each command runs synchronously, as Redis
    // runs each command atomically, so INCR hands out distinct numbers.
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: { body: string }) => {
      expect(url).toBe('https://fake-upstash.test/pipeline');
      const pipeline = JSON.parse(init.body) as Array<Array<string | number>>;
      commands.push(...pipeline);
      if (failRoundKeys && pipeline.some((c) => String(c[1]).endsWith(':critique-rounds'))) {
        return new Response('upstream down', { status: 500 });
      }
      const results = pipeline.map(([op, key, arg]) => {
        const k = String(key);
        if (op === 'INCR') { store.set(k, (store.get(k) ?? 0) + 1); return { result: store.get(k) }; }
        if (op === 'INCRBY') { store.set(k, (store.get(k) ?? 0) + Number(arg)); return { result: store.get(k) }; }
        if (op === 'EXPIRE') return { result: 1 };
        if (op === 'SET') { if (store.has(k)) return { result: null }; store.set(k, 1); return { result: 'OK' }; }
        return { error: `unsupported ${op}` };
      });
      return new Response(JSON.stringify(results), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('claims each round with INCR and an expiry on a key tied to the visit token id', async () => {
    const { POST, createAnthropicClient, issueVisitToken, VISIT_TOKEN_TTL_SECONDS } = await loadRoute();
    createAnthropicClient.mockReturnValue(stubAnthropic(replies(1)).client);
    const token = issueVisitToken()!;

    expect((await POST(critiqueRequest({ token }))).status).toBe(200);

    const key = `weather-mood:visit:${tokenId(token)}:critique-rounds`;
    expect(commands).toContainEqual(['INCR', key]);
    expect(commands).toContainEqual(['EXPIRE', key, VISIT_TOKEN_TTL_SECONDS]);
    expect(store.get(key)).toBe(1);
  });

  it('four concurrent critiques on one token reach the model at most three times', async () => {
    const { POST, createAnthropicClient, issueVisitToken } = await loadRoute();
    const stub = stubAnthropic(replies(4));
    createAnthropicClient.mockReturnValue(stub.client);
    const token = issueVisitToken()!;
    const ip = uniqueIp();

    const responses = await Promise.all([1, 2, 3, 4].map(() => POST(critiqueRequest({ token, ip }))));

    expect(responses.map((r) => r.status).sort()).toEqual([200, 200, 200, 429]);
    expect(stub.fetch).toHaveBeenCalledTimes(3);
  });

  it('fails closed with 503 when Upstash is configured but unreachable, rather than counting in memory', async () => {
    const { POST, createAnthropicClient, issueVisitToken } = await loadRoute();
    const stub = stubAnthropic(replies(1));
    createAnthropicClient.mockReturnValue(stub.client);
    failRoundKeys = true;

    const response = await POST(critiqueRequest({ token: issueVisitToken()! }));
    expect(response.status).toBe(503);
    expect(stub.fetch).not.toHaveBeenCalled();
  });
});
