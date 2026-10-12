/**
 * Live probe of the critic's structured-output call: one request per model,
 * through the same requestStructured path, prompt and schema the route uses.
 * It exists because the critic's schema was once refused by the API ("Schema
 * is too complex") after about 60 seconds on every call, and nothing offline
 * could have caught that.
 *
 *   node --env-file=.env.local --import tsx scripts/probe-critique-schema.mts
 *   node --env-file=.env.local --import tsx scripts/probe-critique-schema.mts claude-haiku-5-5
 *
 * Needs ANTHROPIC_API_KEY. Costs well under a cent per model. Prints the model,
 * the outcome, elapsed seconds, the parsed scores and adjustments, and usage;
 * never the key.
 */
import Anthropic from '@anthropic-ai/sdk';
import { encode } from 'jpeg-js';
import { CRITIC_EFFORT } from '@/lib/claude/config';
import { requestStructured } from '@/lib/claude/structured';
import { CAPTURE_HEIGHT, CAPTURE_WIDTH } from '@/lib/critique/limits';
import { decodeCritiqueImage } from '@/lib/critique/image';
import { analysePixels } from '@/lib/critique/pixels';
import { adjustProfile } from '@/lib/critique/patch';
import { buildCriticSystemPrompt, buildCriticUserContent } from '@/lib/critique/prompt';
import { CritiqueSchema } from '@/lib/critique/schema';
import { computeVerdict, normaliseScores } from '@/lib/critique/verdict';
import { buildFallbackProfile } from '@/lib/mood/fallback';
import type { MoodInput } from '@/lib/poem';

const DEFAULT_MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5'];
const MAX_TOKENS = 1024;

/** A dark night-sky gradient with a scatter of faint particles. */
function darkFrame(): Buffer {
  const width = CAPTURE_WIDTH;
  const height = CAPTURE_HEIGHT;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      data[o] = Math.round(12 + 28 * t);
      data[o + 1] = Math.round(16 + 26 * t);
      data[o + 2] = Math.round(34 + 40 * t);
      data[o + 3] = 255;
    }
  }
  // Deterministic speckle, so every run sends the same image.
  let seed = 7;
  const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 160; i++) {
    const cx = Math.floor(next() * width);
    const cy = Math.floor(next() * height);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= width || y >= height || dx * dx + dy * dy > 4) continue;
        const o = (y * width + x) * 4;
        data[o] = 150; data[o + 1] = 165; data[o + 2] = 190;
      }
    }
  }
  return encode({ data, width, height }, 80).data;
}

const WEATHER: MoodInput = {
  city: 'Edinburgh', country: 'United Kingdom', temperature: 7, condition: 'overcast', humidity: 86,
  windSpeed: 24, cloudCover: 92, weatherCode: 3, windDirection: 250, uvIndex: 0,
};

async function main(): Promise<number> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set. Try: node --env-file=.env.local --import tsx scripts/probe-critique-schema.mts');
    return 2;
  }
  const models = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 180_000 });

  const jpeg = darkFrame();
  const decoded = decodeCritiqueImage(`data:image/jpeg;base64,${jpeg.toString('base64')}`);
  if (!decoded.ok) {
    console.error(`The probe frame did not decode: ${decoded.reason}`);
    return 1;
  }
  const pixels = analysePixels(decoded.rgba, decoded.width, decoded.height);
  const profile = buildFallbackProfile(WEATHER.condition).visual;
  console.log(`frame: ${decoded.width}x${decoded.height}, ${(jpeg.length / 1024).toFixed(1)} KB, mean luma ${pixels.meanLuminance}, failures: ${pixels.failures.join(', ') || 'none'}`);
  console.log(`max_tokens ${MAX_TOKENS}, effort ${CRITIC_EFFORT}\n`);

  let failures = 0;
  for (const model of models.length > 0 ? models : DEFAULT_MODELS) {
    const started = performance.now();
    const elapsed = () => ((performance.now() - started) / 1000).toFixed(1);
    try {
      const outcome = await requestStructured(
        client,
        {
          model,
          maxTokens: MAX_TOKENS,
          effort: CRITIC_EFFORT,
          system: buildCriticSystemPrompt(),
          content: buildCriticUserContent({ imageBase64: decoded.base64, profile, weather: WEATHER, round: 1, pixels }),
        },
        CritiqueSchema,
      );
      if (outcome.kind !== 'ok') {
        failures += 1;
        console.log(`${model}: HTTP 200, no usable reply (${outcome.kind}) after ${elapsed()} s`);
        if (outcome.kind === 'malformed') console.log(`  ${outcome.detail.slice(0, 300)}`);
        continue;
      }
      const rubric = normaliseScores(outcome.data.scores);
      const verdict = computeVerdict(rubric, pixels.failures);
      const { applied } = adjustProfile(profile, outcome.data.adjustments);
      const { input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens } = outcome.usage;
      console.log(`${model}: HTTP 200 ok in ${elapsed()} s`);
      console.log(`  scores      ${JSON.stringify(rubric.scores)} (total ${rubric.total}, verdict ${verdict})`);
      console.log(`  adjustments ${JSON.stringify(outcome.data.adjustments)}`);
      console.log(`  applied     ${applied.map((a) => `${a.knob}:${a.amount}`).join(', ') || 'none'}`);
      console.log(`  evidence    ${outcome.data.evidence}`);
      console.log(`  critique    ${outcome.data.critique}`);
      console.log(`  usage       input ${input_tokens}, output ${output_tokens}, cache read ${cache_read_input_tokens ?? 0}, cache write ${cache_creation_input_tokens ?? 0}`);
    } catch (err) {
      failures += 1;
      if (err instanceof Anthropic.APIError) {
        console.log(`${model}: HTTP ${err.status ?? 'none'} after ${elapsed()} s: ${err.message}`);
      } else {
        console.log(`${model}: failed after ${elapsed()} s: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return failures === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
