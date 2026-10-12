// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetMemorySpend } from '@/lib/spend-cap';
import { stubAnthropic } from '../helpers/anthropic-stub';

vi.mock('@/lib/claude/client', () => ({ createAnthropicClient: vi.fn() }));

import { createAnthropicClient } from '@/lib/claude/client';
import { POST } from '@/app/api/mood/route';

let ipCounter = 0;

function moodRequest(body: unknown = londonDrizzle) {
  ipCounter += 1;
  return new NextRequest('https://weather-mood.test/api/mood', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `198.51.100.${(ipCounter % 250) + 1}`,
    },
    body: JSON.stringify(body),
  });
}

const londonDrizzle = {
  city: 'London',
  country: 'United Kingdom',
  temperature: 11,
  condition: 'drizzle',
  humidity: 88,
  windSpeed: 14,
  cloudCover: 90,
  weatherCode: 53,
  windDirection: 240,
  uvIndex: 1,
};

function validMood(overrides: Record<string, unknown> = {}) {
  return {
    poem: 'Drizzle beads the railings on the Embankment\nthe 38 bus sighs at Angel\nlamplight smudges in the puddles\nand the river keeps its own counsel',
    poemLocal: 'Drizzle beads the railings on the Embankment\nthe 38 bus sighs at Angel\nlamplight smudges in the puddles\nand the river keeps its own counsel',
    visual: {
      background: { topColor: [40, 52, 70], bottomColor: [92, 104, 120], style: 'linear' },
      particles: {
        colors: [[170, 185, 205], [150, 165, 190], [190, 200, 220], [130, 145, 170]],
        maxCount: 999, // out of range on purpose: the clamp must catch it
        spawnRate: 22,
        sizeRange: [1, 3],
        alphaRange: [0.3, 0.7],
        speedRange: [4, 9],
        direction: 'down',
        lifespan: [2, 5],
        drawStyle: 'line',
      },
      effects: {
        ripples: { active: true, color: [110, 130, 150], rate: 10 },
        lightning: { active: false, interval: [5, 15] },
        cloudNoise: { active: true, opacity: 0.12, scale: 0.004 },
        glow: { active: true, color: [230, 190, 120], intensity: 0.25 },
      },
      description: 'Slate dusk with fine rain lines and a warm lamplight glow',
    },
    voice: 'serene_female',
    fontFamily: 'Libre Baskerville',
    languageCode: 'en',
    musicDirection: 'Brushed jazz piano under soft rain, 64 BPM.',
    ambienceDirection: 'Fine London drizzle on a bus shelter roof, tyres hissing on wet tarmac.',
    ...overrides,
  };
}

describe('POST /api/mood with structured outputs', () => {
  beforeEach(() => {
    resetMemorySpend();
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.mocked(createAnthropicClient).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the parsed mood, clamped, with a visit token (happy path)', async () => {
    const stub = stubAnthropic([{ text: JSON.stringify(validMood()) }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);

    const response = await POST(moodRequest());
    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data._source).toBe('ai');
    expect(data.poem).toContain('Embankment');
    expect(data.voice).toBe('serene_female');
    expect(data.fontFamily).toBe('Libre Baskerville');
    expect(data.visual.particles.maxCount).toBe(400);
    expect(typeof data.visitToken).toBe('string');
  });

  it('sends one structured-output request to the configured director model', async () => {
    const stub = stubAnthropic([{ text: JSON.stringify(validMood()) }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);

    await POST(moodRequest());

    expect(stub.requests).toHaveLength(1);
    const sent = stub.requests[0] as {
      model: string;
      max_tokens: number;
      system: string;
      thinking?: unknown;
      output_config: { effort: string; format: { type: string; schema: { required: string[] } } };
    };
    expect(sent.model).toBe('claude-sonnet-5-5');
    expect(sent.max_tokens).toBeGreaterThanOrEqual(4096);
    expect(sent.thinking).toBeUndefined();
    expect(sent.output_config.effort).toBe('low');
    expect(sent.output_config.format.type).toBe('json_schema');
    expect(sent.output_config.format.schema.required).toEqual(
      expect.arrayContaining(['poem', 'poemLocal', 'visual', 'voice', 'fontFamily', 'languageCode', 'musicDirection', 'ambienceDirection']),
    );
    expect(sent.system).not.toMatch(/ONLY raw JSON/i);
    expect(sent.system).not.toContain('—');
  });

  it('honours WEATHER_MOOD_DIRECTOR_MODEL', async () => {
    vi.stubEnv('WEATHER_MOOD_DIRECTOR_MODEL', 'claude-haiku-5-5');
    const stub = stubAnthropic([{ text: JSON.stringify(validMood()) }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);

    await POST(moodRequest());
    expect(stub.requests[0].model).toBe('claude-haiku-5-5');
  });

  it('falls back to the hand-written profile on a refusal', async () => {
    const stub = stubAnthropic([{ text: null, stopReason: 'refusal', refusalCategory: 'general_harms' }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);

    const response = await POST(moodRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data._source).toBe('fallback:refusal');
    expect(data.poem.length).toBeGreaterThan(0);
    expect(data.visual.particles.drawStyle).toBe('line'); // drizzle maps to the rain fallback
    expect(typeof data.visitToken).toBe('string');
  });

  it('falls back when the reply is cut off at max_tokens', async () => {
    const truncated = JSON.stringify(validMood()).slice(0, 180);
    const stub = stubAnthropic([{ text: truncated, stopReason: 'max_tokens' }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);

    const data = await (await POST(moodRequest())).json();
    expect(data._source).toBe('fallback:max_tokens');
  });

  it('falls back when the reply does not match the schema', async () => {
    const stub = stubAnthropic([{ text: JSON.stringify({ poem: 42, visual: 'blue' }) }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);

    const data = await (await POST(moodRequest())).json();
    expect(data._source).toBe('fallback:malformed');
  });

  it('falls back when the reply is not JSON at all', async () => {
    const stub = stubAnthropic([{ text: 'Here is your mood profile: rainy and grey.' }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);

    const data = await (await POST(moodRequest())).json();
    expect(data._source).toBe('fallback:malformed');
  });

  it('keeps the reply when one enum field is off the list, defaulting just that field', async () => {
    const stub = stubAnthropic([{ text: JSON.stringify(validMood({ voice: 'robot_baritone' })) }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);

    const data = await (await POST(moodRequest())).json();
    expect(data._source).toBe('ai');
    expect(data.voice).toBe('serene_female');
    expect(data.poem).toContain('Embankment');
  });

  it('returns 500 when the API itself fails', async () => {
    const stub = stubAnthropic([{ text: null, httpStatus: 500 }]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(moodRequest());
    expect(response.status).toBe(500);
    quiet.mockRestore();
  });

  it('rejects invalid input without calling Claude or reserving spend', async () => {
    const stub = stubAnthropic([]);
    vi.mocked(createAnthropicClient).mockReturnValue(stub.client);

    const response = await POST(moodRequest({ city: '' }));
    expect(response.status).toBe(400);
    expect(stub.fetch).not.toHaveBeenCalled();
  });
});
