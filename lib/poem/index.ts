/**
 * Poem generation module — public API.
 */

export { getCacheKey, getCachedPoem, setCachedPoem, clearCache, getCacheSize } from './cache';
export { buildSystemPrompt, buildUserMessage } from './prompt';
export type { PoemInput } from './prompt';
