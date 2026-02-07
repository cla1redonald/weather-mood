# Weather Mood

A full-screen generative art experience that transforms real-time weather data into immersive visual, audio, and poetic moments. Enter any city and watch particles dance with the wind, colors shift with temperature, ambient tones pulse with humidity, and an AI-generated poem capture the mood.

![Weather Mood Screenshot](Screenshot showing a full-screen canvas with flowing particles in shades of blue and grey for rainy London, with a poem overlay at the bottom reading: "Grey skies weep gently / Thames reflects silver sorrow / London's quiet tears")

## Features

Weather Mood creates a unique, layered experience for every city and weather condition:

### 1. Visual Layer (Canvas 2D)
- **6 weather modes**: Rain, Snow, Clear, Cloudy, Storm, Wind
- **Procedural particle system** with up to 500 particles (desktop) or 200 (mobile)
- **Weather-driven parameters**:
  - Temperature → color palette (cold blues to warm ambers)
  - Wind → particle velocity and direction
  - Humidity → particle density and blur
  - Cloud cover → background depth and opacity
- **Smooth transitions** between cities (2-second cross-fade)

### 2. Audio Layer (Web Audio API)
- **4 synthesized sound layers**:
  - Base tone: Temperature-driven pitch (80Hz cold to 300Hz hot)
  - Wind modulation: LFO wobble intensity tied to wind speed
  - Humidity filter: Low-pass filter cutoff (dry = crisp, humid = muffled)
  - Precipitation layer: Filtered white noise for rain/snow
- **All audio is synthesized** — no audio files, no dependencies
- **Mute/unmute control** with visual hint (M key or on-screen button)

### 3. Poetry Layer (Claude API)
- **AI-generated poems** tailored to specific city + weather conditions
- **Caching**: Same city + condition returns the same poem for 1 hour
- **Graceful degradation**: App works fully even if Claude API is unavailable

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Rendering**: Canvas 2D API + simplex-noise (~2KB)
- **Audio**: Web Audio API (no libraries)
- **AI**: Claude API via `@anthropic-ai/sdk`
- **APIs**: Open-Meteo (weather & geocoding, no key required)
- **Testing**: Vitest + React Testing Library
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- (Optional) Anthropic API key for poem generation

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/weather-mood.git
   cd weather-mood
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Set up environment variables:
   ```bash
   cp .env.example .env
   ```

   Add your Anthropic API key to `.env`:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Available Scripts

- `npm run dev` — Start development server
- `npm run build` — Build for production
- `npm run start` — Start production server
- `npm run lint` — Run ESLint
- `npm test` — Run tests with Vitest
- `npm run typecheck` — Run TypeScript type checking

## Environment Variables

Create a `.env` file in the project root with:

```bash
# Anthropic API key for poem generation (optional)
# Get your key from: https://console.anthropic.com/
ANTHROPIC_API_KEY=your_api_key_here
```

**Note**: The app works fully without an API key. If `ANTHROPIC_API_KEY` is not set, poems will not generate, but the visual and audio layers will still function.

## How It Works

### Architecture Overview

Weather Mood uses a unidirectional data flow:

1. **City Search** (Open-Meteo Geocoding) → Lat/Lon
2. **Weather Fetch** (Open-Meteo Weather API) → Raw weather data
3. **Classification** (WMO codes) → Weather condition (rain, snow, clear, etc.)
4. **Normalization** → All values mapped to 0-1 range
5. **Distribution** → Normalized params drive visual, audio, and poem engines

```
┌─────────────┐
│ City Search │
└──────┬──────┘
       │
       v
┌─────────────┐
│Weather Fetch│
└──────┬──────┘
       │
       v
┌─────────────┐      ┌────────────┐
│ Normalize   ├─────►│ Visual     │
│ Parameters  │      │ Engine     │
└──────┬──────┘      └────────────┘
       │
       ├────────────►┌────────────┐
       │             │ Audio      │
       │             │ Engine     │
       │             └────────────┘
       │
       └────────────►┌────────────┐
                     │ Poem       │
                     │ Generation │
                     └────────────┘
```

### Weather Classification

Weather is classified into 6 conditions based on WMO weather codes:

| Condition | WMO Codes | Description |
|-----------|-----------|-------------|
| **Rain** | 51-67, 80-82 | Drizzle, rain, rain showers |
| **Snow** | 71-77, 85-86 | Snow, snow showers |
| **Clear** | 0-3 (wind ≤40 km/h) | Clear to partly cloudy |
| **Cloudy** | 45-48 | Overcast, fog |
| **Storm** | 95-99 | Thunderstorm |
| **Wind** | 0-3 (wind >40 km/h) | Clear sky with high wind |

### Data Normalization

All weather parameters are normalized to a 0-1 range:

- **Temperature**: -20°C (0.0) → 45°C (1.0)
- **Wind Speed**: 0 km/h (0.0) → 100 km/h (1.0)
- **Humidity**: 0% (0.0) → 100% (1.0)
- **Cloud Cover**: 0% (0.0) → 100% (1.0)

## Testing

The project has 235 tests covering:

- **Unit tests** (160 tests): Weather classification, normalization, audio/visual parameter mapping, palette interpolation, particle systems, poem generation
- **Component tests** (63 tests): CitySearch, WeatherInfo, MuteToggle, PoemOverlay
- **Integration tests** (6 tests): Full weather data pipeline (search → fetch → classify → normalize)
- **Edge case tests** (25 tests): Extreme values, null/undefined handling, boundary conditions

Run tests:
```bash
npm test
```

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel project settings:
   - `ANTHROPIC_API_KEY` (optional)
4. Deploy

The app will be live at `https://your-project.vercel.app`

### Manual Deployment

```bash
npm run build
npm run start
```

## Credits

- **Weather Data**: [Open-Meteo](https://open-meteo.com) (free weather API)
- **Poem Generation**: [Claude API](https://www.anthropic.com/api) by Anthropic
- **Noise Generation**: [simplex-noise](https://github.com/jwagner/simplex-noise.js)

## License

MIT

---

**Built with [Claude Code](https://claude.com/claude-code)**
