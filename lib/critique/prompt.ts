/**
 * Prompt for the critic. It is framed as a reviewer of someone else's work,
 * because models tend to go easier on output they take to be their own, and a
 * critic that likes everything makes the loop pointless.
 */
import type Anthropic from '@anthropic-ai/sdk';
import type { MoodInput } from '@/lib/poem';
import type { VisualProfile } from '@/types/mood';
import type { PixelReport } from '@/lib/critique/pixels';
import { MAX_CRITIQUE_ROUNDS } from '@/lib/critique/limits';

export function buildCriticSystemPrompt(): string {
  return `You review generative weather art made by another artist. Each piece is a live canvas for one city's current weather: a background gradient, drifting particles and a few effects (ripples, lightning, cloud noise, glow), all set by a visual profile you will be shown.

A short poem sits over the bottom centre of the canvas in light text on a dark translucent glass panel. The screenshot does not include the panel or the poem. Judge the region where it sits: roughly the middle 40% of the width, from 65% to 95% of the height.

You are not the artist and owe the work nothing. Your job is to find what does not work yet. Name at least one concrete defect you can see, tied to a place in the frame or to a profile value. If you find none, say why each criterion holds up; do not just praise the piece.

Score five criteria from 1 to 5. For each, write the evidence first (one sentence about what you see in this screenshot), then the score.
- palette: do the colours match the temperature and the condition? Cold reads blue and white, heat reads amber and red, rain is wet and muted, a clear day is luminous, night is deep rather than grey.
- density: is the particle field the right amount for this weather, neither empty nor cluttered?
- poemContrast: will light text on a dark glass panel read clearly over the poem region? Bright or busy backgrounds there are a defect.
- focalPoint: is there somewhere for the eye to rest, or is the frame uniform or chaotic?
- cityFlavour: does anything in the colour or motion make this feel like this city rather than anywhere with this weather?

5 means you would not change it. 4 means a small issue a viewer would not notice. 3 or below means a viewer would notice. Score what you see; do not round up out of politeness.

The measured pixel statistics come from the server and are facts. Use them as evidence.

Then write:
- defect: the single most important concrete defect, or why there is none.
- critique: one sentence for the viewer, under 110 characters, starting lower case, saying what feels off and what you are changing. For example: "the grey feels flat for a humid afternoon, adding amber". Plain words, British spelling, no em dashes, no exclamation marks.
- patch: only the fields you would change to fix the defects you named, within the stated ranges. Leave everything else out. Change as little as fixes the problem; this is a revision, not a new piece.`;
}

export interface CriticInput {
  imageBase64: string;
  profile: VisualProfile;
  weather: MoodInput;
  round: number;
  pixels: PixelReport;
}

export function buildCriticUserContent(input: CriticInput): Anthropic.ContentBlockParam[] {
  const { weather, round, pixels, profile } = input;
  const place = weather.country ? `${weather.city}, ${weather.country}` : weather.city;
  const facts = [
    `City: ${place}.`,
    `Weather now: ${weather.condition}, ${weather.temperature}°C, ${weather.humidity}% humidity, ${weather.windSpeed} km/h wind, ${weather.cloudCover}% cloud cover, UV index ${weather.uvIndex}.`,
    `Review round ${round} of ${MAX_CRITIQUE_ROUNDS}.`,
    '',
    'Measured pixel statistics (Rec. 709 luma, 0 to 255):',
    `- mean luminance ${pixels.meanLuminance}, standard deviation ${pixels.luminanceStdDev}`,
    `- edge density ${pixels.edgeDensity} (above 15 reads as noise)`,
    `- mean luminance behind the poem panel ${pixels.poemRegionLuminance}`,
    pixels.failures.length > 0
      ? `- automatic checks failed: ${pixels.failures.join(', ')}. This piece will be revised whatever you score; make the patch fix these.`
      : '- automatic checks passed.',
    '',
    'Current visual profile:',
    JSON.stringify(profile),
  ].join('\n');

  return [
    {
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: input.imageBase64 },
    },
    { type: 'text', text: facts },
  ];
}
