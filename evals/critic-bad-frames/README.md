# Critic bad frames

Synthetic 768 by 432 frames with known defects, used to check that the critic sends broken work back for revision.

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

The controls exist to catch false positives: a real storm is dark and a real snowfall is bright, and neither should trip the pixel checks. Judging whether 400 particles is too many for the weather is the model's density score, not arithmetic.

Frames come from a seeded random source, so every run sees the same pixels, and are encoded the way the browser does it (JPEG quality 0.8, stepping down if over 150 KB) and decoded by the same code as `/api/critique`.

## Running

```bash
npm run eval:critic              # offline: pixel checks only, free
node --env-file=.env.local --import tsx evals/critic-bad-frames/run.ts --live
```

`--live` sends the five frames with an expected verdict to the critic model (`WEATHER_MOOD_CRITIC_MODEL`, default `claude-sonnet-5-5`). It prints an estimate first (about 9 cents) and the actual cost from token usage at the end. The offline half also runs in CI as part of `vitest`.

## Results

Offline: 8 of 8 frames get their expected pixel verdict.

Live: pending. Nobody has run `--live` yet. Expect the good frame to be the hard case: it is a plain synthetic gradient, so the critic may fairly mark it down on city flavour.
