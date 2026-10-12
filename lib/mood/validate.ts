/**
 * Validation shared by the mood and critique routes. Both accept the same
 * weather description from the browser, and both treat it as untrusted.
 */
import type { MoodInput } from '@/lib/poem';
import { VOICE_PERSONAS, type VoicePersona } from '@/lib/mood/schema';

export function validateMoodInput(body: unknown): MoodInput | null {
  if (typeof body !== 'object' || body === null) return null;

  const { city, country, temperature, condition, humidity, windSpeed, cloudCover, weatherCode, windDirection, uvIndex } =
    body as Record<string, unknown>;

  if (typeof city !== 'string' || city.trim().length === 0) return null;
  if (typeof temperature !== 'number' || !isFinite(temperature)) return null;
  if (typeof condition !== 'string' || condition.trim().length === 0) return null;
  if (typeof humidity !== 'number' || !isFinite(humidity)) return null;
  if (typeof windSpeed !== 'number' || !isFinite(windSpeed)) return null;
  if (typeof cloudCover !== 'number' || !isFinite(cloudCover)) return null;

  return {
    city: city.trim().slice(0, 120),
    country: typeof country === 'string' ? country.trim().slice(0, 120) : undefined,
    temperature,
    condition: condition.trim().slice(0, 80),
    humidity,
    windSpeed,
    cloudCover,
    weatherCode: typeof weatherCode === 'number' ? weatherCode : 0,
    windDirection: typeof windDirection === 'number' ? windDirection : 0,
    uvIndex: typeof uvIndex === 'number' ? uvIndex : 0,
  };
}

export function validateVoicePersona(voice: unknown): VoicePersona {
  if (typeof voice === 'string' && (VOICE_PERSONAS as readonly string[]).includes(voice)) {
    return voice as VoicePersona;
  }
  return 'serene_female';
}

export function validateLanguageCode(code: unknown): string {
  if (typeof code !== 'string') return 'en';
  const trimmed = code.trim();
  return /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(trimmed) ? trimmed : 'en';
}

/** A non-empty trimmed string, or the fallback. */
export function textOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}
