/**
 * Visit tokens tie the ElevenLabs routes (music, sfx, narrate) to a prior
 * /api/mood generation. Without one, those routes were open proxies: anyone
 * could post arbitrary prompt text and spend the ElevenLabs quota.
 *
 * A token is an HMAC-SHA256 signed claim set with a short expiry. It is issued
 * by /api/mood and must be presented in the `x-visit-token` header. Each route
 * then claims a single-use grant for the token (see api-guard.ts), so one mood
 * generation buys at most one music, one sfx and one narration call.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_VERSION = 1;
export const VISIT_TOKEN_TTL_SECONDS = 15 * 60;
export const VISIT_TOKEN_HEADER = 'x-visit-token';

const DEV_SECRET = 'weather-mood-dev-secret-not-for-production';

export interface VisitClaims {
  v: number;
  id: string;
  iat: number;
  exp: number;
}

export type VerifyResult =
  | { ok: true; claims: VisitClaims }
  | { ok: false; reason: 'disabled' | 'missing' | 'malformed' | 'bad_signature' | 'expired' };

function getSecret(): string | null {
  const configured = process.env.VISIT_TOKEN_SECRET;
  if (configured && configured.length >= 16) return configured;
  // Local development and tests work without configuration. Production does not:
  // a missing secret disables the audio routes rather than leaving them open.
  if (process.env.NODE_ENV !== 'production') return DEV_SECRET;
  return null;
}

export function visitTokensEnabled(): boolean {
  return getSecret() !== null;
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function issueVisitToken(now = Date.now(), ttlSeconds = VISIT_TOKEN_TTL_SECONDS): string | null {
  const secret = getSecret();
  if (!secret) return null;

  const iat = Math.floor(now / 1000);
  const claims: VisitClaims = {
    v: TOKEN_VERSION,
    id: randomBytes(12).toString('hex'),
    iat,
    exp: iat + ttlSeconds,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyVisitToken(token: string | null | undefined, now = Date.now()): VerifyResult {
  const secret = getSecret();
  if (!secret) return { ok: false, reason: 'disabled' };
  if (!token) return { ok: false, reason: 'missing' };

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' };

  const expected = Buffer.from(sign(parts[0], secret));
  const given = Buffer.from(parts[1]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (
    typeof claims !== 'object' || claims === null ||
    (claims as VisitClaims).v !== TOKEN_VERSION ||
    typeof (claims as VisitClaims).id !== 'string' ||
    !/^[0-9a-f]{24}$/.test((claims as VisitClaims).id) ||
    typeof (claims as VisitClaims).iat !== 'number' ||
    typeof (claims as VisitClaims).exp !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }

  const valid = claims as VisitClaims;
  if (valid.exp * 1000 <= now) return { ok: false, reason: 'expired' };

  return { ok: true, claims: valid };
}
