/**
 * The single place an Anthropic client is constructed. Routes call this rather
 * than `new Anthropic()` so tests can swap in a client whose `fetch` is a stub,
 * which exercises the real SDK request and parse path with no network call.
 */
import Anthropic from '@anthropic-ai/sdk';

export function createAnthropicClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey });
}
