/**
 * In-memory poem cache with TTL.
 * Resets on cold start (Vercel Edge Function), which is acceptable for this project.
 */

interface CacheEntry {
  poem: string;
  timestamp: number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

const cache = new Map<string, CacheEntry>();

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
 * Clear the entire cache. Useful for testing.
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get the current cache size. Useful for testing.
 */
export function getCacheSize(): number {
  return cache.size;
}
