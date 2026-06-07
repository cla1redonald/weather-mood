import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import {
  guardGenerationRequest,
  InvalidJsonError,
  parseJsonBody,
  RequestBodyTooLargeError,
} from '@/lib/api-guard';

function request(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('https://weather-mood.test/api/mood', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
      ...headers,
    },
    body,
  });
}

describe('api generation guard', () => {
  it('rejects oversized requests from content-length before reading the body', async () => {
    const response = await guardGenerationRequest(
      request('{}', { 'content-length': '99' }),
      { bucket: 'test-size-header', maxRequests: 10, windowSeconds: 60, maxBodyBytes: 10 },
    );

    expect(response?.status).toBe(413);
    await expect(response?.json()).resolves.toEqual({ error: 'Request body too large' });
  });

  it('rate-limits repeated requests in the same bucket', async () => {
    const config = { bucket: `test-rate-${Date.now()}`, maxRequests: 2, windowSeconds: 60, maxBodyBytes: 100 };
    const headers = { 'x-forwarded-for': '198.51.100.10' };

    expect(await guardGenerationRequest(request('{}', headers), config)).toBeNull();
    expect(await guardGenerationRequest(request('{}', headers), config)).toBeNull();

    const blocked = await guardGenerationRequest(request('{}', headers), config);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get('Retry-After')).toBeTruthy();
  });
});

describe('parseJsonBody', () => {
  it('parses JSON under the byte limit', async () => {
    await expect(parseJsonBody(request('{"city":"London"}'), 100)).resolves.toEqual({ city: 'London' });
  });

  it('throws a typed error for invalid JSON', async () => {
    await expect(parseJsonBody(request('{'), 100)).rejects.toBeInstanceOf(InvalidJsonError);
  });

  it('throws a typed error when the decoded body exceeds the byte limit', async () => {
    await expect(parseJsonBody(request('{"text":"abcdef"}'), 8)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });
});
