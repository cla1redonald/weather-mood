/**
 * Poem generation module — public API.
 */

export {
  getCacheKey,
  getCachedPoem,
  setCachedPoem,
  getCachedMood,
  setCachedMood,
  clearCache,
  getCacheSize,
  getMoodCacheSize,
} from './cache';
export type { MoodCacheEntry } from './cache';
export {
  buildSystemPrompt,
  buildUserMessage,
  buildMoodSystemPrompt,
  buildMoodUserMessage,
} from './prompt';
export type { PoemInput, MoodInput } from './prompt';
