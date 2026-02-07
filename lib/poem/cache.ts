/**
 * In-memory poem cache with TTL.
 * Resets on cold start (Vercel Edge Function), which is acceptable for this project.
 */

import type { VisualProfile } from '@/types/mood';

interface CacheEntry {
  poem: string;
  timestamp: number;
}

export interface MoodCacheEntry {
  poem: string;
  visual: VisualProfile;
  voice: string;
  timestamp: number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

const cache = new Map<string, CacheEntry>();
const moodCache = new Map<string, MoodCacheEntry>();

/**
 * Generate a cache key from city and weather condition.
 */
export function getCacheKey(city: string, condition: string): string {
  return `${city.toLowerCase().trim()}:${condition}`;
}

/**
 * Get a cached poem if it exists and hasn't expired.
 */
export function getCachedPoem(key: string, ttlMs: number = DEFAULT_TTL_MS): string | null {
  const entry = cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > ttlMs) {
    cache.delete(key);
    return null;
  }

  return entry.poem;
}

/**
 * Store a poem in the cache.
 */
export function setCachedPoem(key: string, poem: string): void {
  cache.set(key, {
    poem,
    timestamp: Date.now(),
  });
}

/**
 * Get a cached mood profile if it exists and hasn't expired.
 */
export function getCachedMood(key: string, ttlMs: number = DEFAULT_TTL_MS): MoodCacheEntry | null {
  const entry = moodCache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > ttlMs) {
    moodCache.delete(key);
    return null;
  }

  return entry;
}

/**
 * Store a mood profile in the cache.
 */
export function setCachedMood(
  key: string,
  poem: string,
  visual: VisualProfile,
  voice: string,
): void {
  moodCache.set(key, {
    poem,
    visual,
    voice,
    timestamp: Date.now(),
  });
}

/**
 * Clear the entire cache. Useful for testing.
 */
export function clearCache(): void {
  cache.clear();
  moodCache.clear();
}

/**
 * Get the current cache size. Useful for testing.
 */
export function getCacheSize(): number {
  return cache.size;
}

/**
 * Get the current mood cache size. Useful for testing.
 */
export function getMoodCacheSize(): number {
  return moodCache.size;
}
