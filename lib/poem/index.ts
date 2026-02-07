/**
 * Poem generation module — public API.
 */

export {
  buildSystemPrompt,
  buildUserMessage,
  buildMoodSystemPrompt,
  buildMoodUserMessage,
} from './prompt';
export type { PoemInput, MoodInput } from './prompt';
