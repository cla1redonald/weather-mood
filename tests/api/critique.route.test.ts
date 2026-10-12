// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { issueVisitToken } from '@/lib/visit-token';
import { resetMemorySpend } from '@/lib/spend-cap';
import { buildFallbackProfile } from '@/lib/mood/fallback';
import type { CritiqueResponse } from '@/lib/critique/types';
import { frameCase, frameToDataUrl } from '../../evals/critic-bad-frames/frames';
import { stubAnthropic } from '../helpers/anthropic-stub';

vi.mock('@/lib/claude/client', () => ({ createAnthropicClient: vi.fn() }));

import { createAnthropicClient } from '@/lib/claude/client';
import { POST } from '@/app/api/critique/route';

const goodFrame = frameToDataUrl(frameCase('good-dusk').render());
const blackFrame = frameToDataUrl(frameCase('all-black').render());
const profile = buildFallbackProfile('drizzle').visual;
const weather = {
  city: 'Lisbon', country: 'Portugal', temperature: 27, condition: 'clear', humidity: 70,
  windSpeed: 9, cloudCover: 10, weatherCode: 0, windDirection: 300, uvIndex: 7,
};

let ipCounter = 0;

function critiqueRequest(options: { token?: string | null; image?: string; round?: number; body?: unknown } = {}) {
  ipCounter += 1;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-for': `192.0.2.${(ipCounter % 250) + 1}`,
  };
  if (options.token) headers['x-visit-token'] = options.token;
  const body = options.body ?? { image: options.image ?? goodFrame, profile, weather, round: options.round ?? 1 };
  return new NextRequest('https://weather-mood.test/api/critique', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function rubric(score: number, overrides: Record<string, number> = {}) {
  const criterion = (name: string) => ({
    evidence: `The ${name} is what it is in this frame.`,
    score: overrides[name] ?? score,
  });
  return {
    palette: criterion('palette'),
    density: criterion('density'),
    poemContrast: criterion('poemContrast'),
    focalPoint: criterion('focalPoint'),
    cityFlavour: criterion('cityFlavour'),
  };
}

function criticReply(scores: ReturnType<typeof rubric>, patch: Record<string, unknown> = {}) {
  return JSON.stringify({
    scores,
    defect: 'The upper third is a flat slate grey with nothing to hold the eye.',
    critique: 'the grey feels flat for a humid afternoon — adding amber',
    patch,
  });
}

describe('POST /api/critique', () => {
  beforeEach(() => {
    resetMemorySpend();
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.mocked(createAnthropicClient).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('refuses a request without a visit token, before calling the critic', async () => {
    const stub = stubAnthropic([]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);

    const response = await POST(critiqueRequest({ token: null }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ reason: 'missing' });
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it('allows three rounds per token and refuses the fourth with 429', async () => {
    const reply = { text: criticReply(rubric(3)) };
    const stub = stubAnthropic([reply, reply, reply]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);
    const token = issueVisitToken()!;

    for (const round of [1, 2, 3]) {
      const ok = await POST(critiqueRequest({ token, round }));
      expect(ok.status).toBe(200);
      expect(((await ok.json()) as CritiqueResponse).round).toBe(round);
    }

    const fourth = await POST(critiqueRequest({ token, round: 4 }));
    expect(fourth.status).toBe(429);
    expect(stub.fetch).toHaveBeenCalledTimes(3);
  });

  it('counts rounds on the server, so replaying round 1 does not reset the cap', async () => {
    const reply = { text: criticReply(rubric(3)) };
    const stub = stubAnthropic([reply, reply, reply]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);
    const token = issueVisitToken()!;

    for (let i = 0; i < 3; i++) await POST(critiqueRequest({ token, round: 1 }));
    const replay = await POST(critiqueRequest({ token, round: 1 }));
    expect(replay.status).toBe(429);
  });

  it('rejects an image over 150 KB with 413 and does not spend a round', async () => {
    const stub = stubAnthropic([{ text: criticReply(rubric(3)) }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);
    const token = issueVisitToken()!;
    const oversized = Buffer.alloc(160 * 1024, 7);
    oversized[0] = 0xff; oversized[1] = 0xd8; oversized[2] = 0xff;

    const response = await POST(critiqueRequest({ token, image: `data:image/jpeg;base64,${oversized.toString('base64')}` }));
    expect(response.status).toBe(413);
    expect(stub.fetch).not.toHaveBeenCalled();

    const next = await POST(critiqueRequest({ token }));
    expect(((await next.json()) as CritiqueResponse).round).toBe(1);
  });

  it('rejects something that is not a JPEG with 400', async () => {
    const png = `data:image/png;base64,${Buffer.from('not really').toString('base64')}`;
    const response = await POST(critiqueRequest({ token: issueVisitToken()!, image: png }));
    expect(response.status).toBe(400);
  });

  it('returns 503 when the daily spend cap is reached, without calling the critic', async () => {
    vi.stubEnv('WEATHER_MOOD_DAILY_CAP_CENTS', '1');
    const stub = stubAnthropic([]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);

    const response = await POST(critiqueRequest({ token: issueVisitToken()! }));
    expect(response.status).toBe(503);
    expect(stub.fetch).not.toHaveBeenCalled();
  });

  it('accepts when every score is 4 or more, and ignores any patch the model offered', async () => {
    const stub = stubAnthropic([{ text: criticReply(rubric(4, { palette: 5 }), { particleCount: 50 }) }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);

    const response = await POST(critiqueRequest({ token: issueVisitToken()! }));
    const data = (await response.json()) as CritiqueResponse;
    expect(data.verdict).toBe('accept');
    expect(data.total).toBe(21);
    expect(data.patch).toEqual({});
    expect(data.profile).toEqual(profile);
  });

  it('revises when any score is below 4, applying the patch through clampVisualProfile', async () => {
    const patch = { topColor: [300, -5, 120], particleCount: 999, glowActive: true, glowColor: [240, 170, 90] };
    const stub = stubAnthropic([{ text: criticReply(rubric(5, { palette: 2 }), patch) }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);

    const response = await POST(critiqueRequest({ token: issueVisitToken()! }));
    const data = (await response.json()) as CritiqueResponse;

    expect(data.verdict).toBe('revise');
    expect(data.scores?.palette.score).toBe(2);
    expect(data.changed).toEqual(expect.arrayContaining(['topColor', 'particleCount', 'glowActive', 'glowColor']));
    expect(data.profile.background.topColor).toEqual([255, 0, 120]);
    expect(data.profile.particles.maxCount).toBe(400);
    expect(data.profile.effects.glow).toMatchObject({ active: true, color: [240, 170, 90] });
    // Untouched fields carry over from the submitted profile.
    expect(data.profile.background.bottomColor).toEqual(profile.background.bottomColor);
    expect(data.profile.particles.drawStyle).toBe(profile.particles.drawStyle);
  });

  it('tidies the viewer sentence: no em dashes reach the ticker', async () => {
    const stub = stubAnthropic([{ text: criticReply(rubric(3)) }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);

    const data = (await (await POST(critiqueRequest({ token: issueVisitToken()! }))).json()) as CritiqueResponse;
    expect(data.critique).toBe('the grey feels flat for a humid afternoon, adding amber');
  });

  it('forces a revise from the pixel checks even when the model scores a black frame highly', async () => {
    const stub = stubAnthropic([{ text: criticReply(rubric(5)) }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);

    const data = (await (await POST(critiqueRequest({ token: issueVisitToken()!, image: blackFrame }))).json()) as CritiqueResponse;
    expect(data.verdict).toBe('revise');
    expect(data.forcedBy).toEqual(expect.arrayContaining(['blank', 'too_dark']));
    expect(data.changed).toEqual(expect.arrayContaining(['topColor', 'bottomColor']));
    expect(data.pixels.meanLuminance).toBeLessThan(14);
  });

  it('still fixes a black frame when the critic refuses', async () => {
    const stub = stubAnthropic([{ text: null, stopReason: 'refusal' }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);
    const quiet = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const response = await POST(critiqueRequest({ token: issueVisitToken()!, image: blackFrame }));
    const data = (await response.json()) as CritiqueResponse;
    expect(response.status).toBe(200);
    expect(data.source).toBe('pixels_only');
    expect(data.verdict).toBe('revise');
    quiet.mockRestore();
  });

  it('returns 502 when the critic gives nothing usable and the pixels are fine', async () => {
    const stub = stubAnthropic([{ text: '{"scores": "lovely"}' }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);
    const quiet = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const response = await POST(critiqueRequest({ token: issueVisitToken()! }));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ reason: 'malformed' });
    quiet.mockRestore();
  });

  it('sends the screenshot and the weather to the configured critic model', async () => {
    vi.stubEnv('WEATHER_MOOD_CRITIC_MODEL', 'claude-haiku-5-5');
    const stub = stubAnthropic([{ text: criticReply(rubric(4)) }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);

    await POST(critiqueRequest({ token: issueVisitToken()! }));
    const sent = stub.requests[0] as {
      model: string;
      max_tokens: number;
      system: string;
      output_config: { effort: string; format: { type: string; schema: { properties: Record<string, unknown> } } };
      messages: Array<{ content: Array<{ type: string; source?: { media_type: string }; text?: string }> }>;
    };
    expect(sent.model).toBe('claude-haiku-5-5');
    expect(sent.output_config.format.type).toBe('json_schema');
    expect(Object.keys(sent.output_config.format.schema.properties)).not.toContain('verdict');
    expect(sent.system).toMatch(/another artist/);
    expect(sent.system).toMatch(/at least one concrete defect/);
    const [image, text] = sent.messages[0].content;
    expect(image).toMatchObject({ type: 'image', source: { media_type: 'image/jpeg' } });
    expect(text.text).toContain('Lisbon, Portugal');
    expect(text.text).toContain('27°C');
  });

  it('is disabled outright in production without a signing secret', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VISIT_TOKEN_SECRET', '');
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await POST(critiqueRequest({ token: 'whatever.token' }));
    expect(response.status).toBe(503);
    quiet.mockRestore();
  });
});
