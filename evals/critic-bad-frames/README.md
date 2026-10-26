# Critic bad frames

These synthetic 768 by 432 frames check that the critic sends broken work back for revision. Four have a known defect, one is a good frame, and three are legitimate scenes that sit close to the edges the checks look for.

| Frame | What it is | Pixel checks | Full critic |
|---|---|---|---|
| `blank` | One flat mid-grey | fail | revise |
| `all-black` | Pure black, as if nothing drew | fail | revise |
| `white-on-white` | Near-white sky, white particles | fail | revise |
| `over-dense-clutter` | 6,000 hard dots in clashing colours | fail | revise |
| `good-dusk` | Dusk gradient, sparse warm glow | pass | accept |
| `control-storm` | Legitimate dark storm with rain streaks | pass | no fixed expectation |
| `control-snow` | Legitimate bright snowfall | pass | no fixed expectation |
| `control-max-particles` | The renderer's 400-particle limit | pass | no fixed expectation |

The three controls are there to catch false positives. A real storm is dark and a real snowfall is bright, and neither should trip the pixel checks. Whether 400 particles is too many for the weather is left to the model's density score, because no arithmetic on the pixels can answer it.

The frames come from a seeded random source, so every run sees the same pixels. They are encoded the way the browser does it, as JPEG at quality 0.8, stepping down if the file is over 150 KB, and decoded by the same code that `/api/critique` uses.

## Running

```bash
npm run eval:critic              # offline: pixel checks only, free
node --env-file=.env.local --import tsx evals/critic-bad-frames/run.ts --live
```

With `--live`, the five frames that have an expected verdict also go to the critic model (`WEATHER_MOOD_CRITIC_MODEL`, default `claude-sonnet-5-5`). The script prints an estimated cost before it starts, about 9 cents, and the actual cost from token usage when it finishes. The offline part also runs in CI as part of `vitest`.

## Results

Offline, 8 of 8 frames get their expected pixel verdict.

Nobody has run `--live` yet, so there is no live result. When someone does, the good frame is likely to be the hard case. It is a plain synthetic gradient with nothing of any particular city in it, and the critic would be fair to mark it down for that.
