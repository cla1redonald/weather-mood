/**
 * npm run eval:critic             offline: pixel checks only, free
 * npm run eval:critic -- --live   also asks the model critic; costs money
 *
 * Live mode needs ANTHROPIC_API_KEY in the environment, for example
 *   node --env-file=.env.local --import tsx evals/critic-bad-frames/run.ts --live
 */
import Anthropic from '@anthropic-ai/sdk';
import { criticModel } from '@/lib/claude/config';
import { PIXEL_THRESHOLDS } from '@/lib/critique/pixels';
import { costCents, ESTIMATED_CENTS_PER_CALL, liveCases, runLiveEval, runOfflineEval } from './evaluate';

function pad(value: string | number, width: number): string {
  return String(value).padEnd(width);
}

async function main(): Promise<number> {
  const live = process.argv.includes('--live');

  console.log('Critic bad frames: deterministic pixel checks');
  console.log(`thresholds: ${JSON.stringify(PIXEL_THRESHOLDS)}\n`);
  console.log(`${pad('frame', 24)}${pad('jpeg', 12)}${pad('mean', 8)}${pad('sd', 8)}${pad('edges', 8)}${pad('failures', 22)}${pad('expect', 8)}result`);
  const offline = runOfflineEval();
  for (const r of offline) {
    console.log(
      pad(r.id, 24) + pad(`${r.jpegKb.toFixed(0)}KB q${r.quality}`, 12) + pad(r.pixels.meanLuminance, 8) +
      pad(r.pixels.luminanceStdDev, 8) + pad(r.pixels.edgeDensity, 8) + pad(r.pixels.failures.join(',') || '-', 22) +
      pad(r.expected, 8) + (r.ok ? 'ok' : 'MISMATCH'),
    );
  }
  const offlinePassed = offline.filter((r) => r.ok).length;
  console.log(`\nOffline: ${offlinePassed} of ${offline.length} frames match their expected pixel verdict.`);

  if (!live) {
    const n = liveCases().length;
    console.log(`\nLive critic not run. With --live it makes ${n} calls to ${criticModel()}, about ${(n * ESTIMATED_CENTS_PER_CALL).toFixed(0)} cents.`);
    return offlinePassed === offline.length ? 0 : 1;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('\n--live needs ANTHROPIC_API_KEY in the environment.');
    return 2;
  }

  const n = liveCases().length;
  console.log(`\nLive: ${n} calls to ${criticModel()}, estimated ${(n * ESTIMATED_CENTS_PER_CALL).toFixed(1)} cents.`);
  const results = await runLiveEval(new Anthropic({ apiKey }));
  for (const r of results) {
    console.log(`${pad(r.id, 24)}${pad(`expect ${r.expected}`, 16)}${pad(`got ${r.actual}`, 14)}${pad(`lowest ${r.lowestScore ?? '-'}`, 11)}${r.ok ? 'ok  ' : 'MISS'}  ${r.critique}`);
  }
  const livePassed = results.filter((r) => r.ok).length;
  console.log(`\nLive: ${livePassed} of ${results.length} frames match their expected verdict. Actual cost ${costCents(results).toFixed(2)} cents.`);
  return offlinePassed === offline.length && livePassed === results.length ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
