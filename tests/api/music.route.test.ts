import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { issueVisitToken } from '@/lib/visit-token';
import { resetMemorySpend } from '@/lib/spend-cap';

vi.mock('@/lib/elevenlabs/client', () => ({
  elevenlabsFetch: vi.fn(async () => new Response('fake-mp3-bytes', { headers: { 'content-type': 'audio/mpeg' } })),
}));

import { elevenlabsFetch } from '@/lib/elevenlabs/client';
import { POST } from '@/app/api/music/route';

function musicRequest(headers: Record<string, string> = {}) {
  return new NextRequest('https://weather-mood.test/api/music', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
      ...headers,
    },
    body: JSON.stringify({ musicDirection: 'Slow piano under rain', poem: 'A short poem.' }),
  });
}

describe('POST /api/music is gated by the visit token', () => {
  beforeEach(() => {
    resetMemorySpend();
    vi.mocked(elevenlabsFetch).mockClear();
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('refuses a request with no token and never calls ElevenLabs', async () => {
    const response = await POST(musicRequest());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ reason: 'missing' });
    expect(elevenlabsFetch).not.toHaveBeenCalled();
  });

  it('refuses a forged token', async () => {
    const response = await POST(musicRequest({ 'x-visit-token': 'forged.token' }));
    expect(response.status).toBe(401);
    expect(elevenlabsFetch).not.toHaveBeenCalled();
  });

  it('serves audio once per token, then refuses the replay', async () => {
    const token = issueVisitToken()!;

    const first = await POST(musicRequest({ 'x-visit-token': token }));
    expect(first.status).toBe(200);
    expect(first.headers.get('content-type')).toBe('audio/mpeg');
    expect(elevenlabsFetch).toHaveBeenCalledTimes(1);

    const replay = await POST(musicRequest({ 'x-visit-token': token }));
    expect(replay.status).toBe(409);
    expect(elevenlabsFetch).toHaveBeenCalledTimes(1);
  });

  it('refuses when the daily spend cap is reached', async () => {
    vi.stubEnv('WEATHER_MOOD_DAILY_CAP_CENTS', '1');
    const response = await POST(musicRequest({ 'x-visit-token': issueVisitToken()! }));
    expect(response.status).toBe(503);
    expect(elevenlabsFetch).not.toHaveBeenCalled();
  });

  it('is disabled outright in production without a signing secret', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VISIT_TOKEN_SECRET', '');
    const response = await POST(musicRequest({ 'x-visit-token': 'whatever.token' }));
    expect(response.status).toBe(503);
    expect(elevenlabsFetch).not.toHaveBeenCalled();
  });
});
