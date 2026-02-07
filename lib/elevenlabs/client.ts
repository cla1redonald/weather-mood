/**
 * Shared ElevenLabs API client used by music, sfx, and narrate routes.
 */

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

export function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set');
  }
  return key;
}

export async function elevenlabsFetch(
  endpoint: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> {
  const apiKey = getApiKey();

  const response = await fetch(`${ELEVENLABS_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
  }

  return response;
}

// ── Audio caching ──────────────────────────────────────────

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

interface AudioCacheEntry {
  buffer: ArrayBuffer;
  timestamp: number;
}

const audioCache = new Map<string, AudioCacheEntry>();

export function getCachedAudio(key: string, ttlMs: number = DEFAULT_TTL_MS): ArrayBuffer | null {
  const entry = audioCache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > ttlMs) {
    audioCache.delete(key);
    return null;
  }

  return entry.buffer;
}

export function setCachedAudio(key: string, buffer: ArrayBuffer): void {
  audioCache.set(key, { buffer, timestamp: Date.now() });
}

export function audioCacheKey(...parts: string[]): string {
  return parts.map(p => p.toLowerCase().trim()).join(':');
}
