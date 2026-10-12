/**
 * A real Anthropic SDK client whose `fetch` is a stub. Tests that use it run
 * the SDK's own request building and `messages.parse` validation, and no
 * request ever leaves the process.
 */
import Anthropic from '@anthropic-ai/sdk';
import { vi } from 'vitest';

export interface StubReply {
  /** Text of the single text block; null for a response with no content. */
  text: string | null;
  stopReason?: 'end_turn' | 'max_tokens' | 'refusal';
  refusalCategory?: string | null;
  /** Return an HTTP error instead of a message. */
  httpStatus?: number;
  usage?: { input_tokens: number; output_tokens: number };
}

export interface AnthropicStub {
  client: Anthropic;
  /** Parsed JSON bodies of every request the client sent, in order. */
  requests: Array<Record<string, unknown>>;
  fetch: ReturnType<typeof vi.fn>;
}

export function stubAnthropic(replies: StubReply[]): AnthropicStub {
  const queue = [...replies];
  const requests: Array<Record<string, unknown>> = [];

  const fetchStub = vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
    requests.push(JSON.parse(String(init?.body ?? '{}')));
    const reply = queue.shift();
    if (!reply) throw new Error('stubAnthropic: more requests than scripted replies');

    if (reply.httpStatus && reply.httpStatus >= 400) {
      return new Response(
        JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'stubbed failure' } }),
        { status: reply.httpStatus, headers: { 'content-type': 'application/json' } },
      );
    }

    const stopReason = reply.stopReason ?? 'end_turn';
    const body = {
      id: 'msg_stub',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-5-5',
      content: reply.text === null ? [] : [{ type: 'text', text: reply.text, citations: null }],
      stop_reason: stopReason,
      stop_sequence: null,
      stop_details: stopReason === 'refusal'
        ? { type: 'refusal', category: reply.refusalCategory ?? null, explanation: null }
        : null,
      usage: reply.usage ?? { input_tokens: 1200, output_tokens: 400 },
    };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  const client = new Anthropic({
    apiKey: 'test-key',
    fetch: fetchStub as unknown as typeof fetch,
    maxRetries: 0,
  });

  return { client, requests, fetch: fetchStub };
}

export interface CriticReplyFields {
  scores?: Partial<Record<'palette' | 'density' | 'poemContrast' | 'focalPoint' | 'cityFlavour', number>>;
  /** Score for every criterion not set in `scores`. */
  score?: number;
  evidence?: string;
  defect?: string;
  critique?: string;
  adjustments?: Array<{ knob: string; amount: string }>;
}

/** The JSON text of a critic reply in the shape CritiqueSchema expects. */
export function criticReplyText(fields: CriticReplyFields = {}): string {
  const base = fields.score ?? 3;
  const scores = Object.fromEntries(
    (['palette', 'density', 'poemContrast', 'focalPoint', 'cityFlavour'] as const).map((k) => [k, fields.scores?.[k] ?? base]),
  );
  return JSON.stringify({
    scores,
    evidence: fields.evidence ?? 'The upper third is a flat slate grey band.',
    defect: fields.defect ?? 'The upper third is a flat slate grey with nothing to hold the eye.',
    critique: fields.critique ?? 'the grey feels flat for a humid afternoon, adding amber',
    adjustments: fields.adjustments ?? [],
  });
}
