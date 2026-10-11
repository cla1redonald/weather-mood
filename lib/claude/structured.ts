/**
 * One structured-output call to Claude, with every way it can fail to produce
 * usable data turned into a value the caller must handle.
 *
 * `messages.parse` with `zodOutputFormat` validates the reply against a zod
 * schema. Out of the box it throws when the text does not parse, which hides
 * the stop reason: a reply cut off at `max_tokens`, or a refusal with prose in
 * it, both surface as the same parse error. Wrapping the format's `parse` so
 * it records the failure and returns null lets the response resolve, so the
 * stop reason is checked first and the parse failure is reported last.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

export type StructuredOutcome<T> =
  | { kind: 'ok'; data: T; usage: Anthropic.Usage }
  | { kind: 'refusal'; category: string | null }
  | { kind: 'max_tokens' }
  | { kind: 'malformed'; detail: string };

export interface StructuredRequest {
  model: string;
  maxTokens: number;
  effort: 'low' | 'medium' | 'high';
  system: string;
  content: Anthropic.MessageParam['content'];
}

/**
 * The subset of the SDK client this module needs. Typed this way so tests can
 * hand in a real client wired to a stub `fetch`, and nothing else is assumed.
 */
export type MessagesClient = Pick<Anthropic, 'messages'>;

export async function requestStructured<Schema extends z.ZodType>(
  client: MessagesClient,
  request: StructuredRequest,
  schema: Schema,
): Promise<StructuredOutcome<z.infer<Schema>>> {
  const strictFormat = zodOutputFormat(schema);
  let parseFailure: string | null = null;

  const lenientFormat = {
    type: strictFormat.type,
    schema: strictFormat.schema,
    parse(content: string): z.infer<Schema> | null {
      try {
        return strictFormat.parse(content);
      } catch (err) {
        parseFailure = err instanceof Error ? err.message : String(err);
        return null;
      }
    },
  };

  // API errors (auth, rate limit, overload) propagate: they are not the
  // model's answer and the caller decides how to report them.
  const message = await client.messages.parse({
    model: request.model,
    max_tokens: request.maxTokens,
    system: request.system,
    messages: [{ role: 'user', content: request.content }],
    output_config: { effort: request.effort, format: lenientFormat },
  });

  if (message.stop_reason === 'refusal') {
    return { kind: 'refusal', category: message.stop_details?.category ?? null };
  }
  if (message.stop_reason === 'max_tokens') {
    return { kind: 'max_tokens' };
  }
  if (message.parsed_output === null || message.parsed_output === undefined) {
    return { kind: 'malformed', detail: parseFailure ?? 'no text block in the response' };
  }
  return { kind: 'ok', data: message.parsed_output, usage: message.usage };
}
