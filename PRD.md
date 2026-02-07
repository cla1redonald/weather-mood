# PRD: Weather Mood

> **Status:** Ready for Build
> **Created:** 2026-02-06
> **Last Updated:** 2026-02-06

---

## 1. Problem Statement

### The Pain Point
Weather apps reduce the atmosphere outside to numbers and icons. A "72F partly cloudy" tells you nothing about how the day *feels*. There is no tool that translates weather into an emotional, sensory experience.

### Why It Matters
People want to *feel* the weather, not just read it. A generative art piece that responds to real conditions creates a moment of wonder -- the kind of thing you screenshot and send to a friend.

### Current State
Every weather visualization is single-modality: Banana Weather generates AI images (no sound, no poetry). Optic Weather plays pre-recorded sounds (no procedural visuals). MineWeather maps weather to Minecraft biomes (novelty, not art). No existing project combines procedural visuals, synthesized audio, and AI-generated poetry into a unified experience. That gap is the product.

### Existing Code References
Greenfield project. No existing code.

---

## 2. Solution Overview

### Core Idea
**Weather Mood** is a full-screen generative art experience driven by real weather data. Enter any city and the screen comes alive: flowing particles shift with wind speed, colors warm and cool with temperature, ambient synthesized tones pulse with humidity, and an AI-generated poem fades in to capture the mood. Every city at every moment produces a unique living artwork.

### Success Looks Like
- A friend enters their city and says "whoa" within 3 seconds
- The visual scene is clearly different between a rainy London and a sunny Sydney
- The audio feels like it *belongs* with the visuals (not random)
- The poem adds emotional depth rather than feeling tacked on
- Shareable -- someone screenshots or screen-records it for social media

---

## 3. Users

### Primary User
Friends and community members who receive a link and enter their city. Not weather enthusiasts -- creative/tech-curious people who appreciate generative art.

### Multi-User Consideration
No auth, no accounts, no persistent state. Every visit is stateless. The only future consideration would be shareable URLs with city pre-filled (simple query parameter).

---

## 4. MVP Scope

### In Scope (v1)
- [ ] City search input with geocoding (city name to lat/lon)
- [ ] Real-time weather data fetch from Open-Meteo API
- [ ] Full-screen Canvas 2D generative particle system
- [ ] 6 weather modes: Rain, Snow, Clear/Sunny, Cloudy, Storm, Wind
- [ ] Weather-to-visual parameter mapping (temperature to palette, wind to velocity, humidity to density, cloud cover to depth)
- [ ] Ambient synthesized audio via Web Audio API (temperature to pitch, wind to modulation, humidity to filter, precipitation to noise layer)
- [ ] AI-generated poem via Claude API on Vercel Edge Function
- [ ] Poem caching (same city + weather condition = cached poem for 1 hour)
- [ ] Mute/unmute toggle for audio
- [ ] Minimal floating UI overlay (search, temperature, condition label)
- [ ] Mobile-responsive canvas (full viewport)
- [ ] Smooth transitions when switching cities
- [ ] Loading state while weather data fetches
- [ ] Error handling for invalid cities and API failures
- [ ] Unit tests for weather-to-parameter mapping logic
- [ ] Deployed to Vercel

### Out of Scope (v1)
- Compare mode (side-by-side cities)
- Weather forecast / time-lapse (future weather)
- User accounts or favorites
- Social sharing buttons or OG image generation
- 3D rendering (WebGL/Three.js)
- Pre-recorded audio samples or music
- Offline mode / PWA
- Geolocation (auto-detect user city)
- Historical weather visualization
- Custom themes or user-adjustable parameters
- Multiple poem styles or poets

### Scope Boundary
MVP delivers one seamless experience: enter a city, see/hear/read the weather. No settings, no customization, no persistence. Polish the single flow rather than adding features.

---

## 5. Sequential Thread Plan

### Thread 1: Project Scaffolding and Weather API Integration
**Purpose:** Set up the Next.js project, configure the build pipeline, and implement the weather data layer with Open-Meteo API integration.

**Actions:**
- [ ] Initialize Next.js 14 project with App Router, TypeScript, Tailwind CSS
- [ ] Configure ESLint, Prettier, tsconfig
- [ ] Set up project structure: `src/app/`, `src/lib/`, `src/components/`, `src/types/`
- [ ] Define TypeScript types for weather data (`WeatherData`, `WeatherCondition`, `GeoLocation`)
- [ ] Implement Open-Meteo geocoding client (`lib/weather/geocoding.ts`) -- city name to lat/lon
- [ ] Implement Open-Meteo weather client (`lib/weather/api.ts`) -- fetch current conditions
- [ ] Implement weather condition classifier (`lib/weather/classifier.ts`) -- map WMO codes to 6 weather modes
- [ ] Build weather parameter normalizer (`lib/weather/params.ts`) -- normalize raw values to 0-1 ranges for visual/audio mapping
- [ ] Write unit tests for classifier and normalizer
- [ ] Create basic page layout with placeholder canvas area
- [ ] Verify Vercel deployment works with empty app

**Validation Targets:**
- [ ] `npm run build` passes
- [ ] `npm test` passes with classifier and normalizer tests
- [ ] Entering "London" returns valid weather data in console
- [ ] Deployed to Vercel successfully

**Deliverables:**
- Working Next.js project with weather data pipeline
- Type definitions for all weather data
- Unit tests for weather classification and parameter normalization

**Reasoning Level:** Medium (Sonnet)

**Rationale:** Cross-file integration (types, API clients, classifiers, tests) but follows well-established patterns. No architectural novelty.

**Dependencies:** None
**Parallelizable:** No -- all other threads depend on this foundation

---

### Thread 2: Canvas Particle System and Visual Engine
**Purpose:** Build the full-screen Canvas 2D rendering engine with a particle system that responds to weather parameters.

**Actions:**
- [ ] Install `simplex-noise` (~2KB) for organic noise patterns
- [ ] Build canvas manager (`lib/canvas/renderer.ts`) -- handles resize, DPI scaling, animation loop
- [ ] Implement particle system (`lib/canvas/particles.ts`) -- spawn, update, draw, recycle particle pool
- [ ] Implement color palette engine (`lib/canvas/palette.ts`) -- temperature-driven palette interpolation
- [ ] Build 6 weather visual modes:
  - Rain: falling streams, cool blue-grey palette, ripple effects at bottom
  - Snow: gentle floating particles with slight horizontal drift, white/silver palette, soft blur
  - Clear/Sunny: warm radial gradient background, golden particles rising upward, amber-orange palette
  - Cloudy: slow drifting layered noise, muted grey palette, low opacity
  - Storm: intense burst particles, dark purple/electric blue, intermittent screen flash
  - Wind: strong directional particle streams, speed and direction from wind data
- [ ] Implement weather-to-visual parameter mapping:
  - Temperature (0-1) to palette warmth (cold blues to warm ambers)
  - Wind speed (0-1) to particle velocity and directional bias
  - Humidity (0-1) to particle density and gaussian blur amount
  - Cloud cover (0-1) to background layer opacity and depth
- [ ] Implement smooth transitions between weather modes (cross-fade over ~2 seconds when city changes)
- [ ] Cap particle count based on device (mobile: ~200, desktop: ~500) for performance
- [ ] Build React wrapper component (`components/WeatherCanvas.tsx`) with ref-based canvas management
- [ ] Write unit tests for palette interpolation, parameter mapping, and particle pool logic

**Validation Targets:**
- [ ] Canvas renders full-screen with correct DPI scaling
- [ ] Each of the 6 weather modes is visually distinct
- [ ] Particles respond to parameter changes in real-time
- [ ] Frame rate stays above 30fps on mobile (tested with 200 particles)
- [ ] Tests pass for palette and parameter mapping

**Deliverables:**
- Complete visual rendering engine
- 6 weather mode renderers
- React canvas wrapper component
- Unit tests

**Reasoning Level:** Medium-High (Sonnet/Opus)

**Rationale:** Novel generative art system requiring creative decisions about particle behavior, color theory, and performance optimization. Multiple rendering modes with smooth transitions add complexity.

**Dependencies:** Thread 1 (types and weather parameter interfaces)
**Parallelizable:** Yes -- can run alongside Thread 3 and Thread 4 after Thread 1 completes

---

### Thread 3: Web Audio Synthesizer Engine
**Purpose:** Build the ambient audio system that synthesizes weather-driven soundscapes using the Web Audio API.

**Actions:**
- [ ] Build audio engine manager (`lib/audio/engine.ts`) -- AudioContext lifecycle, master gain, mute/unmute
- [ ] Implement base tone generator (`lib/audio/tone.ts`) -- oscillator with temperature-driven pitch mapping
  - Cold (0.0) = low drone (~80Hz), Hot (1.0) = higher tone (~300Hz)
  - Use sine or triangle wave for warmth
- [ ] Implement wind modulation (`lib/audio/wind.ts`) -- LFO modulating base oscillator
  - Calm (0.0) = steady tone, no modulation
  - Windy (1.0) = deep wobble, high modulation depth
  - LFO rate increases with wind speed (0.5Hz to 4Hz)
- [ ] Implement humidity filter (`lib/audio/humidity.ts`) -- low-pass filter on output
  - Dry (0.0) = high cutoff (crisp, bright)
  - Humid (1.0) = low cutoff (muffled, warm)
- [ ] Implement precipitation layer (`lib/audio/precipitation.ts`) -- white noise with envelope
  - Rain: filtered white noise, steady amplitude
  - Snow: very quiet filtered noise, slow fade in/out
  - No precipitation: silence on this layer
- [ ] Implement smooth parameter transitions (ramp audio params over ~3 seconds when city changes)
- [ ] Handle AudioContext autoplay policy (require user gesture to start audio)
- [ ] Build React hook (`hooks/useWeatherAudio.ts`) -- connect audio engine to weather parameters
- [ ] Write unit tests for parameter mapping functions (pitch calc, LFO rate calc, filter calc)

**Validation Targets:**
- [ ] Audio starts after user interaction (no autoplay errors)
- [ ] Mute/unmute works cleanly (no pops or clicks)
- [ ] Sound is clearly different between hot/sunny and cold/rainy
- [ ] Audio transitions smoothly when switching cities
- [ ] Tests pass for all parameter mapping functions

**Deliverables:**
- Complete audio synthesis engine
- 4 audio layers (tone, wind modulation, humidity filter, precipitation noise)
- React hook for audio integration
- Unit tests

**Reasoning Level:** Medium-High (Sonnet/Opus)

**Rationale:** Web Audio API requires careful AudioContext lifecycle management, and designing pleasant ambient sound from raw oscillators requires creative audio design. Browser autoplay policies add complexity.

**Dependencies:** Thread 1 (types and weather parameter interfaces)
**Parallelizable:** Yes -- can run alongside Thread 2 and Thread 4 after Thread 1 completes

---

### Thread 4: AI Poem Generation (Claude API)
**Purpose:** Build the server-side poem generation endpoint and client-side poem display with caching.

**Actions:**
- [ ] Create Vercel Edge Function API route (`app/api/poem/route.ts`)
- [ ] Implement Claude API integration using `@anthropic-ai/sdk`
  - Prompt: Given city name, temperature, weather condition, wind, and humidity, generate a 4-6 line evocative poem
  - Prompt tuning: poem should feel connected to the *specific* conditions, not generic weather poetry
  - Use haiku-class model for speed and cost efficiency
- [ ] Implement server-side poem cache (`lib/poem/cache.ts`)
  - Cache key: `${city}:${weatherCondition}` (e.g., "london:rain")
  - TTL: 1 hour (same city + same condition = same poem)
  - Use in-memory Map (resets on cold start, which is fine)
- [ ] Build poem display component (`components/PoemOverlay.tsx`)
  - Elegant serif typography (system fonts: Georgia, Times)
  - Positioned bottom-center with generous padding
  - Fade-in animation (opacity 0 to 1 over 2 seconds, delayed 3 seconds after weather loads)
  - Semi-transparent dark background for readability over canvas
- [ ] Handle loading state (no poem visible until it arrives)
- [ ] Handle error state (silently omit poem if API fails -- visuals and audio are the primary experience)
- [ ] Write unit tests for cache logic and prompt construction
- [ ] Add `ANTHROPIC_API_KEY` to `.env.example` and Vercel environment variables documentation

**Validation Targets:**
- [ ] Poem generates within 3 seconds for a given city
- [ ] Same city + condition returns cached poem on second request
- [ ] Poem text is evocative and specific to the weather (not generic)
- [ ] Poem overlay is readable over all 6 weather visual modes
- [ ] App works without poem if API key is missing (graceful degradation)

**Deliverables:**
- Vercel Edge Function for poem generation
- Poem caching layer
- Poem overlay React component
- Unit tests

**Reasoning Level:** Medium (Sonnet)

**Rationale:** Standard API integration pattern. The creative work is in prompt engineering, but the implementation is straightforward API route + display component.

**Dependencies:** Thread 1 (types and weather data)
**Parallelizable:** Yes -- can run alongside Thread 2 and Thread 3 after Thread 1 completes

---

### Thread 5: UI Shell and City Search
**Purpose:** Build the minimal UI overlay -- city search, weather info display, mute button -- and wire everything together.

**Actions:**
- [ ] Build city search component (`components/CitySearch.tsx`)
  - Floating search input, top-center, pill-shaped, semi-transparent
  - Debounced input (300ms) with geocoding lookup
  - City suggestion dropdown (top 5 results from Open-Meteo geocoding)
  - Enter key or click selects city
  - Search input collapses to just city name after selection (click to re-expand)
- [ ] Build weather info display (`components/WeatherInfo.tsx`)
  - Current temperature (large text) and condition label (small text)
  - Positioned top-left, minimal, semi-transparent
  - Appears after weather data loads
- [ ] Build mute/unmute toggle (`components/MuteToggle.tsx`)
  - Simple icon button, bottom-right corner
  - Speaker icon / muted speaker icon
  - Triggers AudioContext resume on first unmute (autoplay policy)
- [ ] Build main page (`app/page.tsx`) -- compose all components
  - Full viewport layout, no scroll
  - Layer order: Canvas (back) > Poem overlay > UI controls (front)
  - Wire city search to weather fetch, weather data to canvas + audio + poem
  - Loading state: subtle pulsing animation while fetching weather
  - Default city: show a prompt "Enter a city to begin" or load a default (e.g., user's timezone-guessed major city)
- [ ] Implement URL query parameter support (`?city=London`) for shareability
- [ ] Add keyboard shortcut: Escape to clear/re-focus search, M to toggle mute
- [ ] Style all components with Tailwind CSS -- glass-morphism aesthetic (backdrop-blur, semi-transparent backgrounds)
- [ ] Ensure mobile responsive: search input and controls adapt to small screens
- [ ] Write integration tests: city search triggers weather fetch, weather data flows to all consumers

**Validation Targets:**
- [ ] Full flow works: type city, see visuals change, hear audio, read poem
- [ ] UI is unobtrusive -- visuals are the star, not the chrome
- [ ] Works on mobile viewport (375px width)
- [ ] URL with `?city=Paris` loads Paris weather directly
- [ ] All controls are accessible (keyboard navigable, proper ARIA labels)

**Deliverables:**
- All UI components
- Main page composition
- Integration tests
- Complete user-facing experience

**Reasoning Level:** Medium (Sonnet)

**Rationale:** UI composition and wiring. The individual components are straightforward, but getting the layering, responsiveness, and state flow right across all components requires care.

**Dependencies:** Threads 2, 3, 4 (all rendering/audio/poem systems must exist to wire together)
**Parallelizable:** No -- this is the integration thread that brings everything together

---

### Thread 6: Performance, Polish, and Error Handling
**Purpose:** Optimize canvas performance, add smooth transitions, handle edge cases, and polish the overall experience.

**Actions:**
- [ ] Profile canvas rendering -- ensure 60fps desktop, 30fps mobile
  - Implement adaptive particle count (reduce particles if frame time exceeds 20ms)
  - Use `requestAnimationFrame` with frame skip logic if needed
  - Ensure canvas cleanup on unmount (no memory leaks)
- [ ] Add smooth city-transition animation
  - Cross-fade between old and new weather states over 2 seconds
  - Audio parameters ramp smoothly (no jarring jumps)
  - Poem fades out, new poem fades in
- [ ] Error handling sweep:
  - Invalid city: show inline message below search, don't crash
  - Network failure: show retry prompt, keep last known state
  - Open-Meteo rate limit: graceful fallback message
  - Claude API failure: silently skip poem (visuals/audio still work)
- [ ] Mobile optimizations:
  - Touch-friendly search input (no tiny tap targets)
  - Reduce particle count on mobile
  - Test on Safari iOS (Canvas and Web Audio quirks)
- [ ] Add subtle entrance animation on first load (canvas fades in from black)
- [ ] Verify no console errors or warnings in production build
- [ ] Run `tsc --noEmit` to verify clean TypeScript compilation
- [ ] Final visual QA: verify all 6 weather modes look good
- [ ] Final audio QA: verify all weather conditions sound distinct and pleasant

**Validation Targets:**
- [ ] Lighthouse performance score > 80 on mobile
- [ ] No memory leaks after switching cities 10 times
- [ ] All error states handled gracefully (no white screens)
- [ ] TypeScript compiles cleanly
- [ ] All tests pass

**Deliverables:**
- Performance-optimized rendering
- Polished transitions and error handling
- Mobile-optimized experience

**Reasoning Level:** Medium (Sonnet)

**Rationale:** Optimization and polish work. Requires profiling and iterating but no novel architecture.

**Dependencies:** Thread 5 (full app must be wired together)
**Parallelizable:** No -- requires the complete integrated app

---

### Thread 7: Testing and Documentation
**Purpose:** Write remaining tests, verify full test suite, and create project documentation.

**Actions:**
- [ ] Write/verify unit tests:
  - Weather classifier: all WMO codes map correctly
  - Parameter normalizer: edge cases (0, max values, negative temps)
  - Palette interpolation: boundary values
  - Audio parameter mapping: frequency ranges, filter cutoffs
  - Poem cache: TTL expiry, key generation
- [ ] Write component tests:
  - CitySearch: debounce behavior, suggestion selection
  - WeatherInfo: displays correct temperature and condition
  - MuteToggle: toggles state correctly
  - PoemOverlay: fade-in timing, handles missing poem
- [ ] Write integration test:
  - Mock weather API, verify full flow from city input to rendered state
- [ ] Verify all tests pass: `npm test`
- [ ] Write `README.md`:
  - Project description and screenshot/gif
  - Tech stack overview
  - Setup instructions (clone, install, env vars, dev server)
  - Deployment instructions (Vercel)
  - Architecture overview (visual engine, audio engine, poem generation)
  - Environment variables (ANTHROPIC_API_KEY)
- [ ] Add `.env.example` with documented variables
- [ ] Final `npm run build` verification

**Validation Targets:**
- [ ] All unit tests pass
- [ ] All component tests pass
- [ ] Integration test passes
- [ ] Test coverage on core logic (weather mapping, audio mapping) > 80%
- [ ] README is complete and accurate
- [ ] `npm run build` succeeds
- [ ] `npm test` succeeds

**Deliverables:**
- Complete test suite
- README.md
- .env.example

**Reasoning Level:** Low (Sonnet)

**Rationale:** Tests follow established patterns from the code already written. Documentation is straightforward.

**Dependencies:** Thread 6 (all code must be finalized)
**Parallelizable:** No -- needs finalized codebase

---

### Thread Execution Guidance

1. **Thread 1** runs first (foundation)
2. **Threads 2, 3, 4** run in parallel (visual engine, audio engine, poem generation -- independent systems)
3. **Thread 5** runs after 2+3+4 complete (integration)
4. **Thread 6** runs after 5 (polish)
5. **Thread 7** runs after 6 (testing + docs)

```
Thread 1 ──────────────────────────┐
                                    ├── Thread 5 ── Thread 6 ── Thread 7
Thread 2 (Canvas)  ─────────┐      │
Thread 3 (Audio)   ─────────┼──────┘
Thread 4 (Poem)    ─────────┘
```

**Estimated agent-hours:** ~5-6 hours total, ~3-4 hours wall-clock with parallelization.

### Completion Log Template

After each thread, record:
```
**Thread [N] Completion Log:**
- Status: Complete / Partial / Blocked
- Files Modified:
  - `path/file.ts:XX-YY` - [what changed]
- Tests Added: [list test files]
- Issues Discovered: [any problems found]
- Notes for Next Thread: [context to carry forward]
```

---

## 6. User Experience

> **See also:** `APP_FLOW.md` for the full screen inventory, route map, and detailed navigation flows.

### Key User Flows

**Flow 1: First Visit**
1. User opens the URL -- sees a dark screen with a floating search input and "Enter a city to begin" prompt
2. User types a city name (e.g., "Tokyo")
3. Suggestions appear below the input -- user selects one
4. Canvas springs to life with weather-driven particles and colors
5. Audio begins playing (muted by default -- user clicks unmute to hear)
6. After 3 seconds, a poem fades in at the bottom
7. User is immersed in the experience

**Flow 2: Switching Cities**
1. User clicks the collapsed city name to re-expand search
2. Types a new city
3. Visuals cross-fade smoothly to new weather
4. Audio parameters ramp to new values
5. Old poem fades out, new poem fades in

**Flow 3: Sharing**
1. User copies the URL (which includes `?city=Tokyo`)
2. Friend opens the URL -- immediately sees Tokyo's weather mood
3. No onboarding, no sign-up -- straight into the experience

### Primary Interface
A full-screen generative canvas with three floating UI elements: search input (top-center), weather info (top-left), and mute toggle (bottom-right). The poem overlays the bottom-center of the canvas. The canvas IS the interface -- everything else is secondary.

### UX Requirements
- Immersive first: UI controls must not distract from the generative art
- Glass-morphism aesthetic: semi-transparent backgrounds with backdrop blur
- Typography: elegant serif for the poem, clean sans-serif for UI controls
- Instant feedback: search suggestions appear as you type
- Graceful degradation: if poem fails, the experience still works with visuals + audio
- Audio off by default (respect autoplay policies), easy unmute

### UI References
- **Aspire to:** Windmill.co landing page (immersive generative backgrounds), Stripe's gradient animations
- **Avoid:** Dashboard aesthetic, weather app feel, card-based layouts, any visible borders or boxes

---

## 7. Data Model

### Core Entities
No database. All data is ephemeral and in-memory.

| Entity | Key Fields | Notes |
|--------|-----------|-------|
| WeatherData | temperature, windSpeed, windDirection, humidity, cloudCover, weatherCode, uvIndex | Fetched from Open-Meteo, consumed by all systems |
| WeatherCondition | mode (rain/snow/clear/cloudy/storm/wind) | Classified from WMO weather code |
| NormalizedParams | tempNorm, windNorm, humidityNorm, cloudNorm (all 0-1) | Derived from WeatherData for visual/audio engines |
| GeoLocation | lat, lon, cityName, country | From Open-Meteo geocoding |
| PoemCache | key (city:condition), poem (string), timestamp | In-memory Map on Edge Function, 1hr TTL |

### Security & Privacy
- No user data collected or stored
- `ANTHROPIC_API_KEY` stored as Vercel environment variable, never exposed to client
- Open-Meteo requires no API key
- No cookies, no analytics, no tracking

---

## 8. Integrations

### Required (MVP)
| Service | Purpose | Auth |
|---------|---------|------|
| Open-Meteo Geocoding API | City name to coordinates | None (free, no key) |
| Open-Meteo Weather API | Current weather conditions | None (free, no key) |
| Claude API (Anthropic) | Poem generation | API key (server-side only) |

### Future
- Open-Meteo Forecast API (for time-lapse / future weather)
- Web Share API (native sharing on mobile)
- Canvas `toBlob()` for screenshot generation

---

## 9. Technical Specification

### Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS
- **Rendering:** Canvas 2D API + simplex-noise (~2KB)
- **Audio:** Web Audio API (no libraries)
- **AI:** Claude API via `@anthropic-ai/sdk`
- **Hosting:** Vercel (Edge Functions for poem API)
- **Testing:** Vitest + React Testing Library
- **Package Manager:** npm

### Non-Negotiables
- [ ] Tests required (unit + component + integration)
- [ ] TypeScript strict mode, `tsc --noEmit` must pass
- [ ] No heavy rendering libraries (no Three.js, no Pixi.js, no p5.js)
- [ ] No audio libraries (no Tone.js, no Howler.js)
- [ ] Deployed to Vercel from start
- [ ] ANTHROPIC_API_KEY never exposed to client

### Architecture Principles
- **Separation of engines:** Visual, audio, and poem systems are independent modules consuming the same `NormalizedParams`
- **Reactive data flow:** Weather data flows one-way: API -> normalize -> distribute to engines
- **Progressive enhancement:** Visuals work without audio; visuals+audio work without poem
- **Performance budget:** <500KB JS bundle, 60fps desktop, 30fps mobile

### File Structure (Planned)
```
src/
  app/
    page.tsx                  # Main page composition
    layout.tsx                # Root layout
    api/
      poem/
        route.ts              # Edge Function for poem generation
  lib/
    weather/
      api.ts                  # Open-Meteo weather client
      geocoding.ts            # Open-Meteo geocoding client
      classifier.ts           # WMO code -> WeatherCondition
      params.ts               # Raw values -> NormalizedParams (0-1)
    canvas/
      renderer.ts             # Canvas manager, animation loop, DPI
      particles.ts            # Particle pool system
      palette.ts              # Temperature -> color palette
      modes/
        rain.ts               # Rain visual mode
        snow.ts               # Snow visual mode
        clear.ts              # Clear/sunny visual mode
        cloudy.ts             # Cloudy visual mode
        storm.ts              # Storm visual mode
        wind.ts               # Wind visual mode
    audio/
      engine.ts               # AudioContext lifecycle, master gain
      tone.ts                 # Base oscillator (temperature -> pitch)
      wind.ts                 # LFO modulation (wind -> wobble)
      humidity.ts             # Low-pass filter (humidity -> cutoff)
      precipitation.ts        # White noise layer (rain/snow)
    poem/
      cache.ts                # In-memory poem cache with TTL
      prompt.ts               # Prompt construction for Claude
  components/
    WeatherCanvas.tsx         # React wrapper for canvas engine
    CitySearch.tsx            # City search with suggestions
    WeatherInfo.tsx           # Temperature and condition display
    MuteToggle.tsx            # Audio mute/unmute button
    PoemOverlay.tsx           # Poem display with fade-in
  hooks/
    useWeatherData.ts         # Fetch and manage weather state
    useWeatherAudio.ts        # Connect audio engine to weather params
  types/
    weather.ts                # All TypeScript type definitions
```

---

## 10. Constraints

### Hard Constraints
- Must work in Chrome, Firefox, Safari (latest versions)
- Must work on mobile (iOS Safari, Android Chrome)
- No API keys required for the weather data layer
- Claude API key must stay server-side
- Total JS bundle under 500KB
- Must be deployable to Vercel free tier

### Preferences
- Audio muted by default (autoplay policies)
- Prefer system fonts over web fonts (Georgia for poetry, system sans for UI)
- Canvas 2D over WebGL (simplicity, broader support)
- Edge Function over serverless function for poem API (faster cold starts)

### Anti-Patterns
- Do NOT build a weather dashboard -- this is generative art, not an information display
- Do NOT add weather detail panels, forecast graphs, or data tables
- Do NOT use pre-built weather icon sets
- Do NOT play pre-recorded audio files -- all sound is synthesized
- Do NOT use heavy animation libraries (GSAP, Framer Motion) for the canvas -- raw `requestAnimationFrame`
- Do NOT over-engineer the caching layer -- in-memory Map with TTL is sufficient

---

## 11. Future Vision

### v2 Direction
If v1 lands well with friends and community:
- **Compare mode:** Side-by-side cities (split screen, two canvases)
- **Time-lapse:** Animate through 24-hour forecast to see mood shift from dawn to dusk
- **Share cards:** Generate a static image + poem card for social sharing (OG image generation)
- **Geolocation:** Auto-detect user location on first visit
- **Custom prompts:** Let users choose poem style (haiku, sonnet, free verse, different languages)
- **Seasonal palettes:** Override color schemes for holidays or seasons
- **Ambient mode:** Full-screen kiosk mode for digital frames or ambient displays

---

## 16. Definition of Done

MVP is complete when:
- [ ] Not embarrassing to show a friend
- [ ] Core flow works end-to-end: enter city -> see visuals + hear audio + read poem
- [ ] All 6 weather modes produce visually distinct scenes
- [ ] Audio is pleasant and weather-responsive (not annoying or random)
- [ ] Poem feels connected to the specific weather conditions
- [ ] Works on mobile (375px viewport, iOS Safari)
- [ ] Performance: 60fps desktop, 30fps mobile
- [ ] Live on Vercel
- [ ] Tests passing
- [ ] README with setup instructions
- [ ] Graceful degradation if Claude API is unavailable

---

## 17. Open Questions

1. **Default state:** Should the app load with a random world city on first visit, or show an empty state with just the search prompt? (Recommendation: empty state -- let the user choose their first city for maximum impact.)
2. **Poem length:** 4-6 lines feels right, but should the prompt specify a form (haiku, free verse) or leave it open? (Recommendation: free verse, 4-6 lines, no strict form.)
3. **Audio default:** Muted by default is safe, but should there be a visual hint that audio is available? (Recommendation: subtle pulsing speaker icon on first load, then static.)

---

## Appendix: Agent Notes

*This section is populated by agents during the build process*

### Technical Architect
[Architecture decisions, rationale]

### UX/UI Designer
[Design decisions, component notes]

### DevSecOps
[Infrastructure notes, security considerations]

### Other Notes

**Pre-mortem Risks:**
| Risk | Type | Severity | Mitigation |
|------|------|----------|------------|
| Canvas too many particles on mobile -> frame drops | Tiger (real) | High | Adaptive particle count, cap at 200 on mobile, frame-time monitoring |
| Web Audio API browser support | Paper Tiger (seems scary, isn't) | Low | Excellent support since 2020. Just handle autoplay policy correctly |
| Poem feels disconnected from visuals | Elephant (hidden) | Medium | Prompt engineering: include specific weather values, city character. Cache helps iterate on prompts without cost pressure |
| Open-Meteo rate limiting on high traffic | Tiger (real) | Low | Free tier is generous (10k/day). For a friends-and-community project, won't be an issue |
| AudioContext resume fails silently | Tiger (real) | Medium | Clear user gesture requirement, visible mute/unmute state, test on iOS Safari |

---

## Creative Vision v2: Every Visit Is a Teleportation

> **Updated:** 2026-02-07

### The Shift

v1 cached creative content by city+condition and used hardcoded cultural mappings (Tokyo = koto, Paris = accordion). This made the experience feel predetermined. v2 makes every single visit fully generative — Claude interprets the weather, the city, and the moment, and everything flows from that single interpretation.

### Core Principles

1. **Unique every time.** Same city, same weather, different visit = different poem, different music, different visuals, different voice. No mood/music/SFX caching.
2. **Claude is the creative director.** It generates `musicDirection` (a vivid prompt for AI music generation) and `ambienceDirection` (a vivid prompt for AI SFX generation) alongside the poem and visual/sound profiles. No hardcoded city→instrument or city→ambience mappings anywhere.
3. **Richer weather inputs.** Raw WMO weather code (distinguishing "heavy drizzle" from "light rain"), wind direction (cardinal), and UV index all feed into Claude's interpretation for finer atmospheric differentiation.
4. **Seamless creative flow.** The poem's emotional arc, the music's genre and tempo, the ambient SFX, and the visual palette all emerge from one unified AI interpretation. They feel like they belong together because they were conceived together.
5. **Transport, not display.** Typing "Marrakech" should make you feel the heat radiating off terracotta walls. The music should carry the spice market's energy. The poem should name a real street. The SFX should have the distant call to prayer. Every sense works together to place you there.

### What Changed (Technical)

| Aspect | v1 | v2 |
|--------|----|----|
| Mood caching | 1hr TTL by city+condition | None — fresh Claude generation every visit |
| Music prompts | 14 hardcoded city→instrument mappings | Claude generates `musicDirection` per visit |
| SFX prompts | 14 hardcoded city→ambience mappings | Claude generates `ambienceDirection` per visit |
| Weather data to AI | condition, temp, humidity, wind, cloud | + WMO code (granular), wind direction, UV index |
| Music/SFX caching | 1hr TTL by city+condition | None — fresh ElevenLabs generation every visit |
| Narration caching | By poem hash | Kept (poems are unique, so narration is unique) |

### Success Looks Like (v2)

- Visit Tokyo twice in the same rainy afternoon → two completely different poems, two different musical pieces, two different visual palettes
- The music for a foggy morning in San Francisco feels nothing like a foggy morning in London — different instruments, different tempo, different emotional register
- A friend says "it felt like I was actually there" not "cool visualization"
