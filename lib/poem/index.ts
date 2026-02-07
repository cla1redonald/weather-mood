/**
 * Poem generation module — public API.
 */

export {
  getCacheKey,
  getCachedPoem,
  setCachedPoem,
  clearCache,
  getCacheSize,
} from './cache';
export {
  buildSystemPrompt,
  buildUserMessage,
  buildMoodSystemPrompt,
  buildMoodUserMessage,
} from './prompt';
export type { PoemInput, MoodInput } from './prompt';
