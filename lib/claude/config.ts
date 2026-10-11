/**
 * Every Claude model id and call setting lives here, so a model change is a
 * one-line edit or an environment variable, never a search through routes.
 *
 * Both defaults are Claude Sonnet 5.5. Any override must support structured
 * outputs (`output_config.format`) and `output_config.effort`; Claude Haiku 4.5,
 * for example, has no effort parameter and would be rejected with a 400.
 */

export const DEFAULT_DIRECTOR_MODEL = 'claude-sonnet-5-5';
export const DEFAULT_CRITIC_MODEL = 'claude-sonnet-5-5';

function modelFromEnv(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  return raw ? raw : fallback;
}

/** The model that writes the poem and designs the visual, voice and score. */
export function directorModel(): string {
  return modelFromEnv('WEATHER_MOOD_DIRECTOR_MODEL', DEFAULT_DIRECTOR_MODEL);
}

/** The model that looks at a screenshot of the canvas and critiques it. */
export function criticModel(): string {
  return modelFromEnv('WEATHER_MOOD_CRITIC_MODEL', DEFAULT_CRITIC_MODEL);
}

// Thinking counts toward max_tokens even when its text is not returned, so
// these leave room for it on top of the reply itself.
export const DIRECTOR_MAX_TOKENS = 8192;
export const CRITIC_MAX_TOKENS = 4096;

// Low effort keeps thinking short on content generation and rubric scoring,
// which is what both calls are. Raise only with a measured quality gain.
export const DIRECTOR_EFFORT = 'low' as const;
export const CRITIC_EFFORT = 'low' as const;
