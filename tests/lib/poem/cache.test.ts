import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getCacheKey,
  getCachedPoem,
  setCachedPoem,
  clearCache,
  getCacheSize,
} from '@/lib/poem/cache';

describe('poem cache', () => {
  beforeEach(() => {
    clearCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getCacheKey', () => {
    it('creates a lowercase key from city and condition', () => {
      expect(getCacheKey('London', 'rain')).toBe('london:rain');
    });

    it('trims whitespace from city', () => {
      expect(getCacheKey('  Tokyo  ', 'clear')).toBe('tokyo:clear');
    });

    it('handles mixed case', () => {
      expect(getCacheKey('New York', 'STORM')).toBe('new york:STORM');
    });
  });

  describe('getCachedPoem / setCachedPoem', () => {
    it('returns null for missing entries', () => {
      expect(getCachedPoem('london:rain')).toBeNull();
    });

    it('stores and retrieves a poem', () => {
      setCachedPoem('london:rain', 'The rain falls softly');
      expect(getCachedPoem('london:rain')).toBe('The rain falls softly');
    });

    it('returns null for expired entries', () => {
      vi.useFakeTimers();
      setCachedPoem('london:rain', 'The rain falls softly');

      // Advance time past TTL (1 hour + 1ms)
      vi.advanceTimersByTime(60 * 60 * 1000 + 1);

      expect(getCachedPoem('london:rain')).toBeNull();
    });

    it('returns poem within TTL window', () => {
      vi.useFakeTimers();
      setCachedPoem('london:rain', 'The rain falls softly');

      // Advance time to just under TTL
      vi.advanceTimersByTime(60 * 60 * 1000 - 1);

      expect(getCachedPoem('london:rain')).toBe('The rain falls softly');
    });

    it('respects custom TTL', () => {
      vi.useFakeTimers();
      setCachedPoem('london:rain', 'The rain falls softly');

      // Advance 5 seconds
      vi.advanceTimersByTime(5000);

      // With a 3-second TTL, should be expired
      expect(getCachedPoem('london:rain', 3000)).toBeNull();
    });

    it('overwrites existing entries', () => {
      setCachedPoem('london:rain', 'First poem');
      setCachedPoem('london:rain', 'Second poem');
      expect(getCachedPoem('london:rain')).toBe('Second poem');
    });

    it('removes expired entries from cache on access', () => {
      vi.useFakeTimers();
      setCachedPoem('london:rain', 'The rain falls softly');
      expect(getCacheSize()).toBe(1);

      vi.advanceTimersByTime(60 * 60 * 1000 + 1);
      getCachedPoem('london:rain');

      expect(getCacheSize()).toBe(0);
    });
  });

  describe('clearCache', () => {
    it('removes all entries', () => {
      setCachedPoem('london:rain', 'Poem 1');
      setCachedPoem('tokyo:clear', 'Poem 2');
      expect(getCacheSize()).toBe(2);

      clearCache();
      expect(getCacheSize()).toBe(0);
    });
  });

  describe('getCacheSize', () => {
    it('returns 0 for empty cache', () => {
      expect(getCacheSize()).toBe(0);
    });

    it('reflects number of stored entries', () => {
      setCachedPoem('a:b', 'poem1');
      setCachedPoem('c:d', 'poem2');
      setCachedPoem('e:f', 'poem3');
      expect(getCacheSize()).toBe(3);
    });
  });
});
