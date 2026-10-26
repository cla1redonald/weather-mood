# Weather Mood

Pick a city and Weather Mood paints the weather there right now as a full-screen moving picture. It writes a short poem for the place and reads it aloud over music made to match. Then Claude takes a screenshot of what it drew, judges it against the weather and redraws it while you watch, for up to three rounds.

Try it at [weather-mood-chi.vercel.app](https://weather-mood-chi.vercel.app).

![The Weather Mood social card, with rain, snow and rising light across a twilight canvas and the caption "Pick a city and Weather Mood paints the weather there right now"](assets/social-preview.png)

## What you will see

1. Type a city name, or press Surprise me for a random one. The current weather comes from Open-Meteo.
2. The canvas paints itself. Claude reads the weather and designs a full-screen scene for that place at that hour, choosing the colours of the sky, how the particles fall or drift, and whether there is glow, cloud texture, ripples or lightning.
3. A poem of four to six lines appears, written in English for that city in that weather. It is then read aloud in the city's own language, over music and ambient sound generated for the moment.
4. Claude reviews its own work. A short line under the search bar says what it is doing, for example "Round 2 of 3: the grey feels flat for a humid afternoon, adding amber". Each revision fades in over two seconds. The review stops when the piece passes, after three rounds or after four minutes, and if a revision came out worse than an earlier version, the canvas goes back to the better one. Press Skip to stop it at any point.

The review never runs if your device is set to reduce motion. When Claude declines to answer, or sends back something the page cannot use, you get a hand-written scene for that kind of weather instead. When Claude cannot be reached at all, the canvas is drawn from the weather data alone.

## How the self-critique works

Once the first draft is on screen, the page waits three seconds for the particles to settle. It then takes a 768 by 432 screenshot of the canvas and sends it to Claude with the weather and the settings behind the scene.

Claude is told to review the picture as if someone else had made it, and to name at least one concrete defect or explain why there isn't one. It scores five things from 1 to 5:

- whether the palette fits the temperature and the conditions
- whether the number of particles suits the weather
- whether the poem will be readable over its part of the frame
- whether the eye has somewhere to rest
- whether it feels like this city, rather than anywhere with this weather

It backs its lowest score with one sentence of evidence and writes one sentence for the viewer, which is the line you see under the search bar. Then it picks up to four changes from a fixed list, marking each one small or large. The list is warmer, cooler, lighter, darker, more or fewer particles, bigger or smaller particles, faster, slower, calmer behind the poem, glow added or removed, more or less cloud, and softer or sharper particles.

Claude doesn't get to decide whether its own work passes. The code accepts a piece only when every score is 4 or higher. Separate pixel checks on the screenshot look for a blank frame, a frame too dark or too washed out to read, and a frame that has turned to noise, and any one of those forces a revision whatever Claude scored. Nor does Claude write any setting directly. The server turns each named change into numbers in code (`lib/critique/patch.ts`) and clamps every result to the ranges the renderer can safely draw.

Each round scores what is on screen, so a revision only gets its score in the round after it. So the last round's suggestions are never drawn, because nothing would be left to score them. When the loop stops, the page keeps the best-scoring version and goes back to it if the one on screen scored lower.

## What is tested

There are 377 tests in 28 files. CI runs all of them on every pull request, and none of them make network calls. The Claude tests use a real SDK client with only its network layer stubbed out, so the SDK's own request building and structured-output parsing still run.

| Area | Tests | Covers |
|---|---|---|
| Self-critique | 147 | The critique route (token, round cap, image limits, spend cap, verdicts, adjustments), every adjustment and its fields, direction, small and large steps and clamp limits, the size and shape of the output schema, cost-abuse cases (concurrent requests, per-address limits, expired tokens, a shared store that is down), screen capture, when the browser loop stops and how it rolls back to the best version, the ticker, and the offline eval |
| Director | 25 | Structured outputs, clean fallbacks after a refusal, a truncated reply or a malformed one, the model setting, and the prompt |
| Audio and cost controls | 37 | Visit tokens, single-use audio grants, rate limits, the daily spend cap, and audio playback |
| Canvas and weather | 128 | Weather classification and its edge cases, normalisation, palettes, particles, and the weather pipeline end to end |
| Interface | 40 | City search, mute, the poem overlay and the weather panel |

The critic has its own eval set as well. `evals/critic-bad-frames/` holds eight synthetic frames, each with the verdict it should get. Four are broken on purpose (blank, all black, white on white, and over-dense clutter), one is a good frame, and three are legitimate scenes that must not be flagged (a dark storm, a bright snowfall and the renderer at its particle limit). Offline, the pixel checks get 8 of 8 right. Claude's own verdicts on the five frames that have an expected verdict haven't been measured yet, because nobody has run `npm run eval:critic -- --live` (about 9 cents).

## Cost controls

A visit makes one Claude call to design the piece, up to three more to critique it, and three ElevenLabs calls for the audio.

The director runs on Claude Sonnet 5.5, at $2 per million input tokens and $10 per million output tokens, and costs about 3 cents a visit. The critic runs on the same model and costs about a penny a round. That figure is measured. A round uses about 3,100 input tokens, of which the 768 by 432 screenshot is about 420, and about 330 output tokens. With all three rounds, Claude comes to about 6 cents a visit. ElevenLabs is on top of that and is still the larger share.

The spend cap doesn't use the measured figures. It reserves rounded-up ones instead, 4 cents for the director, 2 cents per critique round, 8 for music, 2 for ambience and 3 for narration, which makes 23 cents for a full visit.

Five controls put a ceiling on what a public deployment can spend.

- `/api/mood` hands out a short-lived signed visit token, and the music, sfx, narrate and critique routes refuse any request without one (401). A token is good for one call to each audio route (a replay gets 409) and three critique rounds (a fourth gets 429), and the server does the counting. Nobody can reach a paid route without going through a mood generation first, so none of them can be used as an open proxy. Set `VISIT_TOKEN_SECRET` in production. Without it those routes return 503 rather than run unprotected.
- Each IP address can make 4 mood generations per 10 minutes and 12 per day. For `/api/critique` the limits are 12 per 10 minutes and 36 per day, so one address can spend at most 72 cents a day on critiques.
- The critique route only accepts a 768 by 432 JPEG of 150 KB or less, and it checks this on the decoded bytes.
- Before it calls upstream, each paid route reserves its estimated cost against a daily total. Once the total passes `WEATHER_MOOD_DAILY_CAP_CENTS` (default 1000, which is $10 or about 43 full visits), paid routes return 503 and the page falls back to silence and visuals drawn from the weather data.
- With `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set, the limits, grants, critique rounds and cap are shared across serverless instances. Without them each instance keeps its own counters, which is a much weaker bound, and the logs say so. If Upstash is configured but can't be reached, critique rounds are refused rather than counted per instance.

Set a hard spend limit with each provider as well, in the Anthropic console and on your ElevenLabs plan. The controls above limit how much a bad day can cost, but they are no substitute for a cap the provider enforces.

## For developers

### Tech stack

- Next.js 14 with the App Router, TypeScript in strict mode, and Tailwind CSS
- Canvas 2D for drawing, with simplex-noise
- Claude through `@anthropic-ai/sdk`, using `messages.parse` with zod schemas for structured outputs
- ElevenLabs for narration, music and ambience, called over its REST API from `lib/elevenlabs/client.ts`. An earlier Web Audio synth in the browser has been removed, so all the sound comes from ElevenLabs.
- Open-Meteo for weather and geocoding, which needs no key
- `jpeg-js` to decode the critic's JPEG on the server for the pixel checks
- Vitest and React Testing Library for tests
- Vercel for hosting, with Upstash Redis as an option for shared limits

Claude plays two roles, both set in `lib/claude/config.ts`. The director writes the poem and designs the scene, along with directions for the voice and the score. The critic reviews the screenshots. Both run on Claude Sonnet 5.5, and you can override them with `WEATHER_MOOD_DIRECTOR_MODEL` and `WEATHER_MOOD_CRITIC_MODEL`.

For one evening the critic ran on Haiku 5.5 instead, after production showed rounds taking 62 to 94 seconds. The time turned out to be the API spending about a minute on the critic's output schema and then refusing it as too complex. Production logs showed the same thing on both models, so the critic had never actually run. With a smaller schema, `scripts/probe-critique-schema.mts` timed one critique at 4.3 seconds on Sonnet 5.5 and 6.8 to 8.7 seconds on Haiku 5.5 (12 Oct 2026), and the critic went back to Sonnet.

### Getting started

You need Node.js 18 or later and npm. The API keys are optional. Without `ANTHROPIC_API_KEY` you get no poem and no critique, and the canvas is drawn from the weather data alone. Without `ELEVENLABS_API_KEY` the page is silent.

```bash
git clone https://github.com/cla1redonald/weather-mood.git
cd weather-mood
npm install
cp .env.example .env.local   # then add your keys
npm run dev                  # http://localhost:3000
```

### Scripts

- `npm run dev` starts the development server
- `npm run build` makes a production build
- `npm run start` serves the production build
- `npm run lint` runs ESLint
- `npm run typecheck` runs TypeScript
- `npm test` runs Vitest (`npx vitest run` for a single pass)
- `npm run social-card` redraws `assets/social-preview.png` from `scripts/social-card/card.html`. It needs Playwright's Chromium, which `npx playwright install chromium` fetches once.
- `npm run eval:critic` runs the critic eval offline. Add `-- --live` to include the model, which costs money.
- `node --env-file=.env.local --import tsx scripts/probe-critique-schema.mts` runs one live critique for each critic model and prints the outcome, elapsed seconds, scores, adjustments and usage. It costs under 2 cents.

### Environment variables

Every variable is listed with a comment in `.env.example`. They are `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `WEATHER_MOOD_DIRECTOR_MODEL`, `WEATHER_MOOD_CRITIC_MODEL`, `VISIT_TOKEN_SECRET`, `WEATHER_MOOD_DAILY_CAP_CENTS` and the Upstash pair.

### Architecture

```
City search (Open-Meteo geocoding)
        |
Weather fetch (Open-Meteo) --> classify and normalise --> canvas (fallback scene)
        |
/api/mood   director: poem, scene, voice, music and ambience directions, visit token
        |
        +--> /api/narrate  (ElevenLabs speech, in the local language)
        +--> /api/music    (ElevenLabs music)
        +--> /api/sfx      (ElevenLabs ambience)
        |
        +--> critique loop in the browser, up to 3 rounds:
               screenshot --> /api/critique (critic: scores and adjustments)
                          --> verdict in code --> crossfade to the revision
```

The files to start with:

- `app/api/mood/route.ts` makes the director call, with fallbacks for a refusal, a truncated reply or a malformed one
- `app/api/critique/route.ts` makes the critic call and holds every limit in front of it
- `lib/critique/` has the capture, pixel checks, rubric schema, adjustments, verdict and the browser loop
- `hooks/useSelfCritique.ts` and `components/CritiqueTicker.tsx` hold the loop's state and the line it shows on screen
- `lib/canvas/renderer.ts` is the renderer, which crossfades over two seconds whenever the scene changes

### Weather classification

When Claude's scene isn't available, the canvas falls back to one of six conditions based on the WMO weather code.

| Condition | WMO codes | Description |
|-----------|-----------|-------------|
| **Rain** | 51-67, 80-82 | Drizzle, rain, rain showers |
| **Snow** | 71-77, 85-86 | Snow, snow showers |
| **Clear** | 0-3 (wind 40 km/h or less) | Clear to partly cloudy |
| **Cloudy** | 45-48 | Overcast, fog |
| **Storm** | 95-99 | Thunderstorm |
| **Wind** | 0-3 (wind over 40 km/h) | Clear sky with high wind |

Weather values are normalised to between 0 and 1. Temperature runs from -20°C to 45°C, wind from 0 to 100 km/h, and humidity and cloud cover from 0% to 100%.

### Deployment

The project deploys on Vercel. In the project settings, set `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY` (music needs a paid ElevenLabs plan), `VISIT_TOKEN_SECRET` and, ideally, the Upstash pair. CI runs lint, typecheck, Vitest and `next build` on every pull request.

## Credits

- Weather data from [Open-Meteo](https://open-meteo.com)
- Poem, scene and critique by [Claude](https://www.anthropic.com/api), from Anthropic
- Narration, music and ambience from [ElevenLabs](https://elevenlabs.io)
- Noise from [simplex-noise](https://github.com/jwagner/simplex-noise.js)

## Licence

MIT

---

Built with [Claude Code](https://claude.com/claude-code)
