/**
 * Minimal Upstash REST pipeline client shared by the rate limiter, the visit
 * grants and the spend cap. Returns null when Upstash is not configured so
 * callers can fall back to per-instance memory.
 */
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export type PipelineResult = Array<{ result?: unknown; error?: string }>;

export function upstashConfigured(): boolean {
  return Boolean(redisUrl && redisToken);
}

export async function upstashPipeline(commands: Array<Array<string | number>>): Promise<PipelineResult | null> {
  if (!redisUrl || !redisToken) return null;

  const response = await fetch(`${redisUrl.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Upstash request failed: ${response.status}`);
  }

  return (await response.json()) as PipelineResult;
}
