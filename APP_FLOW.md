# APP_FLOW.md: Weather Mood

> Complete screen inventory, route map, and navigation flows for the Weather Mood generative weather art experience.

---

## Route Map

| Route | Purpose | Auth |
|-------|---------|------|
| `/` | Main (and only) page -- full-screen generative experience | None |
| `/api/poem` | Edge Function -- generates AI poem from weather data | Server-side API key |

**Query Parameters:**
| Param | Example | Purpose |
|-------|---------|---------|
| `city` | `?city=Tokyo` | Pre-loads a specific city on visit (shareable URLs) |

---

## Screen Inventory

There is one screen. The entire application is a single full-viewport canvas with floating UI overlays.

### Screen: Main Experience (`/`)

**Layout:** Full viewport (100vw x 100vh), no scroll. Four layers stacked via z-index.

```
┌─────────────────────────────────────────────┐
│ Layer 4 (top): UI Controls                  │
│  ┌──────────────┐           ┌─────────────┐ │
│  │ Weather Info  │           │ City Search │ │
│  │ 22°C Rainy   │           │ [Tokyo    ] │ │
│  └──────────────┘           └─────────────┘ │
│                                             │
│                                             │
│ Layer 3: (empty -- breathing room)          │
│                                             │
│                                             │
│                                             │
│ Layer 2: Poem Overlay                       │
│           ┌─────────────────────────┐       │
│           │ The rain falls softly   │       │
│           │ on streets that remember │       │
│           │ every footstep...       │       │
│           └─────────────────────────┘       │
│                                  ┌────┐     │
│ Layer 1 (back): Canvas           │ 🔇 │     │
│ [Full-screen particle system]    └────┘     │
│                                             │
└─────────────────────────────────────────────┘
```

**Layer 1 -- Canvas (z-0):**
- Full viewport, position fixed
- Generative particle system driven by weather data
- Background gradient shifts with temperature
- 6 visual modes: rain, snow, clear, cloudy, storm, wind

**Layer 2 -- Poem Overlay (z-10):**
- Bottom-center, horizontally centered
- Semi-transparent dark background (rgba, backdrop-blur)
- Elegant serif typography (Georgia)
- Fades in 3 seconds after weather loads
- Fades out when switching cities

**Layer 3 -- Breathing Room:**
- No UI elements in the middle third of the screen
- Canvas visuals are the focus

**Layer 4 -- UI Controls (z-20):**
- Top-left: Weather info (temperature + condition)
- Top-center: City search input
- Bottom-right: Mute/unmute toggle

---

## Component Specifications

### City Search (`CitySearch.tsx`)

**States:**

| State | Appearance | Behavior |
|-------|------------|----------|
| Empty (first visit) | Expanded pill input, placeholder "Enter a city..." | Cursor focused, ready for input |
| Typing | Input with text, suggestion dropdown below | Debounced (300ms) geocoding lookup |
| Suggestions visible | Dropdown with up to 5 city results | Click or Enter selects, shows "City, Country" format |
| City selected | Collapsed to just city name text, clickable | Click re-expands to editable input |
| Error | Input with red-tinted border, inline error text | "City not found" or "Connection error, try again" |

**Suggestion Dropdown:**
```
┌──────────────────────────┐
│ Enter a city...          │
├──────────────────────────┤
│ Tokyo, Japan             │
│ Tokyo, United States     │
│ Tokoname, Japan          │
└──────────────────────────┘
```

**Interactions:**
- Type to search (debounced 300ms)
- Arrow keys to navigate suggestions
- Enter to select highlighted suggestion
- Escape to close suggestions / clear input
- Click outside to collapse (if city already selected)

**Responsive:**
- Desktop: 320px wide, centered at top
- Mobile: full width minus 32px padding, centered at top

---

### Weather Info (`WeatherInfo.tsx`)

**States:**

| State | Appearance |
|-------|------------|
| No city selected | Hidden |
| Loading | Subtle pulsing placeholder |
| Loaded | Temperature (large) + condition (small) |
| Error | Hidden (fail silently) |

**Layout:**
```
22°C
Rainy
```

- Temperature: 2rem, font-weight 300, white with 80% opacity
- Condition: 0.875rem, font-weight 400, white with 60% opacity
- Position: top-left, 24px from edges
- Background: none (text directly over canvas, text-shadow for readability)

---

### Mute Toggle (`MuteToggle.tsx`)

**States:**

| State | Icon | Behavior |
|-------|------|----------|
| Muted (default) | Speaker with X | Click starts AudioContext + unmutes |
| Unmuted | Speaker with waves | Click mutes (keep AudioContext alive) |
| First interaction | Subtle pulse animation | Hints that audio is available |

**Position:** Bottom-right, 24px from edges
**Size:** 44x44px tap target (icon 24x24px inside)
**Style:** White icon, 60% opacity, hover 100% opacity

---

### Poem Overlay (`PoemOverlay.tsx`)

**States:**

| State | Appearance |
|-------|------------|
| No poem yet | Hidden |
| Loading | Hidden (no skeleton -- let visuals breathe) |
| Visible | Fade-in over 2 seconds (delayed 3s after weather load) |
| Transitioning | Fade-out over 1 second, then new poem fades in |
| Error (API failed) | Permanently hidden (graceful degradation) |

**Typography:**
- Font: Georgia, Times New Roman, serif
- Size: 1.125rem (18px)
- Line height: 1.8
- Color: white, 90% opacity
- Text align: center
- Max width: 480px

**Container:**
- Background: rgba(0, 0, 0, 0.3)
- Backdrop-filter: blur(8px)
- Border-radius: 12px
- Padding: 24px 32px
- Position: bottom-center, 48px from bottom edge
- Centered horizontally

---

## User Flows

### Flow 1: First Visit (No Query Param)

```
User opens weathermood.vercel.app
         │
         ▼
┌─────────────────────────┐
│ Empty State              │
│ - Black/dark canvas      │
│ - Search input focused   │
│ - "Enter a city..." text │
│ - No weather info        │
│ - No poem               │
│ - Mute icon (static)    │
└─────────────────────────┘
         │
    User types "London"
         │
         ▼
┌─────────────────────────┐
│ Search Suggestions       │
│ - "London" in input      │
│ - Dropdown appears:      │
│   London, United Kingdom │
│   London, Canada         │
│   Londonderry, UK        │
└─────────────────────────┘
         │
    User clicks "London, United Kingdom"
         │
         ▼
┌─────────────────────────┐
│ Loading State            │
│ - Search collapses to    │
│   "London, UK"           │
│ - Subtle pulse animation │
│ - Canvas still dark      │
└─────────────────────────┘
         │
    Weather data arrives (~500ms)
         │
         ▼
┌─────────────────────────┐
│ Active State             │
│ - Canvas comes alive     │
│   (fade from black, 1s)  │
│ - Particles render in    │
│   weather mode (e.g.     │
│   rain)                  │
│ - "8°C / Rainy" appears  │
│   top-left               │
│ - URL updates to         │
│   ?city=London           │
│ - Audio ready (muted)    │
└─────────────────────────┘
         │
    +3 seconds
         │
         ▼
┌─────────────────────────┐
│ Poem Appears             │
│ - Poem fades in at       │
│   bottom-center over 2s  │
│ - Full experience active │
└─────────────────────────┘
```

### Flow 2: Direct Link Visit (`?city=Tokyo`)

```
User opens weathermood.vercel.app?city=Tokyo
         │
         ▼
┌─────────────────────────┐
│ Auto-Load State          │
│ - Search shows "Tokyo"   │
│ - Immediately fetches    │
│   weather for Tokyo      │
│ - Loading pulse          │
└─────────────────────────┘
         │
    Weather data arrives (~500ms)
         │
         ▼
┌─────────────────────────────────┐
│ Active State (same as Flow 1)   │
│ - Canvas alive, weather mode    │
│ - Poem arrives after 3s         │
│ - Mute toggle available         │
└─────────────────────────────────┘
```

### Flow 3: Switching Cities

```
┌─────────────────────────┐
│ Active State (London)    │
│ - Rain particles         │
│ - Cool blue palette      │
│ - London poem visible    │
└─────────────────────────┘
         │
    User clicks "London, UK" text (collapsed search)
         │
         ▼
┌─────────────────────────┐
│ Search Re-expanded       │
│ - Input shows "London"   │
│   (selected, ready to    │
│    overtype)             │
│ - Canvas still showing   │
│   London weather         │
└─────────────────────────┘
         │
    User types "Sydney", selects "Sydney, Australia"
         │
         ▼
┌─────────────────────────┐
│ Transition State         │
│ - Poem fades out (1s)    │
│ - Canvas cross-fades:    │
│   rain particles slow    │
│   and fade, new sunny    │
│   particles emerge (2s)  │
│ - Audio ramps: pitch     │
│   rises, filter opens,   │
│   rain noise fades (3s)  │
│ - Temp updates to 28°C   │
│ - URL updates to         │
│   ?city=Sydney           │
└─────────────────────────┘
         │
    +3 seconds after new weather loads
         │
         ▼
┌─────────────────────────┐
│ Active State (Sydney)    │
│ - Sunny particles rising │
│ - Warm amber palette     │
│ - New poem fades in      │
└─────────────────────────┘
```

### Flow 4: Audio Interaction

```
┌─────────────────────────┐
│ Active State (muted)     │
│ - Visuals playing        │
│ - Mute icon: speaker-X   │
│ - No audio output        │
└─────────────────────────┘
         │
    User clicks mute toggle
         │
         ▼
┌─────────────────────────┐
│ Audio Active             │
│ - AudioContext resumes   │
│ - Ambient tone fades in  │
│   over 1 second          │
│ - Icon: speaker-waves    │
│ - Sound matches weather  │
└─────────────────────────┘
         │
    User clicks mute toggle again
         │
         ▼
┌─────────────────────────┐
│ Audio Muted              │
│ - Master gain ramps to 0 │
│   over 0.5s (no pop)    │
│ - Icon: speaker-X        │
│ - AudioContext stays     │
│   alive (instant resume) │
└─────────────────────────┘
```

### Flow 5: Error States

```
┌─────────────────────────┐
│ User types "asdfghjkl"   │
│ No suggestions appear    │
│ User presses Enter       │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ City Not Found           │
│ - Input border turns     │
│   red-tinted             │
│ - Below input: "City not │
│   found. Try another."   │
│ - Canvas unchanged       │
│ - Previous city (if any) │
│   still showing          │
└─────────────────────────┘

---

┌─────────────────────────┐
│ Network failure during   │
│ weather fetch            │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Connection Error         │
│ - Below input: "Couldn't │
│   fetch weather. Check   │
│   connection."           │
│ - Previous state remains │
│ - Retry on next search   │
└─────────────────────────┘

---

┌─────────────────────────┐
│ Poem API fails           │
│ (Claude API down or no   │
│  API key configured)     │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Silent Degradation       │
│ - Visuals + audio work   │
│   normally               │
│ - Poem overlay never     │
│   appears                │
│ - No error shown to user │
│ - Experience still feels │
│   complete               │
└─────────────────────────┘
```

---

## Visual Mode Reference

Each weather condition maps to a distinct visual treatment.

### Rain
- **Particles:** Vertical falling streams, slight randomized angle
- **Palette:** Cool blue-grey (#4A6FA5, #6B8FC2, #8AAED4, #2C3E50)
- **Background:** Dark blue-grey gradient, subtle
- **Special:** Ripple circles at bottom edge where particles land
- **Particle count:** 300 desktop / 150 mobile
- **Particle speed:** Medium-fast, mostly downward

### Snow
- **Particles:** Gentle floating, slight horizontal drift (sine wave path)
- **Palette:** White/silver/pale blue (#E8EFF5, #C8D6E5, #F0F4F8, #FFFFFF)
- **Background:** Deep navy to dark grey gradient
- **Special:** Soft gaussian blur on particles (varying sizes)
- **Particle count:** 200 desktop / 100 mobile
- **Particle speed:** Slow, drifting

### Clear / Sunny
- **Particles:** Rising upward (like embers or warmth shimmer)
- **Palette:** Amber/gold/warm (#F9A825, #FF8F00, #FFB74D, #FFF3E0)
- **Background:** Warm radial gradient from center (golden core to amber edges)
- **Special:** Larger glowing particles mixed in, slow pulse
- **Particle count:** 250 desktop / 120 mobile
- **Particle speed:** Slow rising

### Cloudy
- **Particles:** Minimal floating particles, large and soft
- **Palette:** Muted grey (#9E9E9E, #757575, #BDBDBD, #E0E0E0)
- **Background:** Layered noise (simplex) drifting slowly
- **Special:** Low opacity, dreamy feel, subtle movement
- **Particle count:** 100 desktop / 50 mobile
- **Particle speed:** Very slow drift

### Storm / Thunder
- **Particles:** Intense bursts in random directions, rain overlay
- **Palette:** Dark purple/electric blue (#1A0033, #4A00E0, #7B1FA2, #00E5FF)
- **Background:** Near-black with electric blue edges
- **Special:** Intermittent full-screen flash (white, 100ms, random interval 5-15s)
- **Particle count:** 400 desktop / 200 mobile
- **Particle speed:** Fast, chaotic

### Wind
- **Particles:** Strong directional streams (direction from wind data)
- **Palette:** Inherits from temperature palette (wind is a modifier, not a color)
- **Background:** Inherits from temperature
- **Special:** Particle trails (previous positions rendered as fading line)
- **Particle count:** 300 desktop / 150 mobile
- **Particle speed:** High, directional (angle matches `windDirection` from API)

---

## Audio Mode Reference

All audio is synthesized in real-time via Web Audio API. No audio files.

### Base Layer (always active)
- **Oscillator:** Sine wave
- **Frequency:** Maps from temperature (0-1 normalized)
  - 0.0 (cold) = 80Hz (low drone)
  - 0.5 (mild) = 160Hz
  - 1.0 (hot) = 300Hz (warmer tone)
- **Gain:** 0.15 (subtle background)

### Wind Layer (modulation)
- **Type:** LFO modulating base oscillator amplitude
- **Rate:** Maps from wind speed (0-1 normalized)
  - 0.0 (calm) = 0.5Hz (barely perceptible wobble)
  - 1.0 (gale) = 4Hz (rapid tremolo)
- **Depth:** Maps from wind speed
  - 0.0 = 0.05 (almost steady)
  - 1.0 = 0.4 (dramatic modulation)

### Humidity Layer (filter)
- **Type:** Low-pass filter on entire output chain
- **Cutoff:** Maps from humidity (0-1 normalized)
  - 0.0 (dry) = 4000Hz (crisp, bright)
  - 1.0 (humid) = 800Hz (muffled, warm)
- **Resonance (Q):** 1.0 (subtle, not resonant)

### Precipitation Layer (noise)
- **Type:** White noise through bandpass filter
- **Active:** Only during rain or snow conditions
- **Rain:** Bandpass 1000-3000Hz, gain 0.1, steady
- **Snow:** Bandpass 2000-6000Hz, gain 0.03, very quiet (whisper)
- **Transition:** Fade in/out over 2 seconds

---

## Responsive Behavior

### Desktop (>768px)
- Canvas: full viewport
- Search: 320px wide, centered at top, 24px from top
- Weather info: top-left, 24px from edges
- Mute: bottom-right, 24px from edges
- Poem: max-width 480px, 48px from bottom

### Mobile (<768px)
- Canvas: full viewport
- Search: full width - 32px (16px each side), centered at top, 16px from top
- Weather info: top-left, 16px from edges, smaller font (1.5rem temp)
- Mute: bottom-right, 16px from edges
- Poem: full width - 32px, 24px from bottom, font-size 1rem

### Interaction Differences
- Desktop: hover states on controls, keyboard shortcuts (Escape, M)
- Mobile: larger tap targets (min 44x44px), no hover states, touch-friendly search

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Escape` | Close search suggestions / re-focus search input |
| `M` | Toggle mute/unmute |
| `ArrowDown` / `ArrowUp` | Navigate search suggestions |
| `Enter` | Select highlighted suggestion |

---

## Animation Timing

| Animation | Duration | Easing | Trigger |
|-----------|----------|--------|---------|
| Canvas fade-in (first load) | 1s | ease-in | Weather data arrives |
| Weather mode cross-fade | 2s | ease-in-out | City changes |
| Poem fade-in | 2s | ease-in | 3s after weather loads |
| Poem fade-out | 1s | ease-out | City changes |
| Audio unmute fade-in | 1s | linear | User clicks unmute |
| Audio mute fade-out | 0.5s | linear | User clicks mute |
| Audio parameter ramp | 3s | linear | City changes |
| Search suggestion dropdown | 0.15s | ease-out | Suggestions arrive |
| Error message appear | 0.3s | ease-out | Error occurs |
| Lightning flash | 0.1s | instant on, ease-out off | Random (5-15s interval in storm mode) |
