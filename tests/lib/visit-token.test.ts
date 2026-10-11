import { afterEach, describe, expect, it, vi } from 'vitest';
import { issueVisitToken, verifyVisitToken, visitTokensEnabled } from '@/lib/visit-token';

describe('visit tokens', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('issues a token that verifies and carries a 24-hex id', () => {
    const token = issueVisitToken();
    expect(token).toBeTruthy();
    const verdict = verifyVisitToken(token);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.claims.id).toMatch(/^[0-9a-f]{24}$/);
      expect(verdict.claims.exp).toBeGreaterThan(verdict.claims.iat);
    }
  });

  it('rejects a missing token', () => {
    expect(verifyVisitToken(null)).toEqual({ ok: false, reason: 'missing' });
    expect(verifyVisitToken('')).toEqual({ ok: false, reason: 'missing' });
  });

  it('rejects a malformed token', () => {
    expect(verifyVisitToken('not-a-token')).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyVisitToken('a.b.c')).toEqual({ ok: false, reason: 'malformed' });
  });

  it('rejects a token whose payload was altered', () => {
    const token = issueVisitToken()!;
    const [payload, sig] = token.split('.');
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    claims.exp += 86400;
    const forged = `${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${sig}`;
    expect(verifyVisitToken(forged)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a token signed with a different secret', () => {
    vi.stubEnv('VISIT_TOKEN_SECRET', 'first-secret-at-least-16-chars');
    const token = issueVisitToken()!;
    vi.stubEnv('VISIT_TOKEN_SECRET', 'second-secret-at-least-16-chars');
    expect(verifyVisitToken(token)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects an expired token', () => {
    const issuedAt = Date.parse('2026-10-11T10:00:00Z');
    const token = issueVisitToken(issuedAt, 60)!;
    expect(verifyVisitToken(token, issuedAt + 30_000).ok).toBe(true);
    expect(verifyVisitToken(token, issuedAt + 61_000)).toEqual({ ok: false, reason: 'expired' });
  });

  it('is disabled in production when no secret is configured', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VISIT_TOKEN_SECRET', '');
    expect(visitTokensEnabled()).toBe(false);
    expect(issueVisitToken()).toBeNull();
    expect(verifyVisitToken('anything.at-all')).toEqual({ ok: false, reason: 'disabled' });
  });

  it('refuses a production secret that is too short', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VISIT_TOKEN_SECRET', 'short');
    expect(visitTokensEnabled()).toBe(false);
  });
});
