import { WeatherCondition } from '@/types/weather';

/**
 * Classify weather based on WMO weather code and wind speed
 *
 * WMO Weather Code Classification:
 * - 0-3: Clear to partly cloudy
 * - 45-48: Fog
 * - 51-67: Drizzle and rain
 * - 71-77: Snow
 * - 80-82: Rain showers
 * - 85-86: Snow showers
 * - 95-99: Thunderstorm
 *
 * Wind threshold: >40 km/h for 'wind' condition
 */
export function classifyWeather(
  weatherCode: number,
  windSpeed: number
): WeatherCondition {
  // Thunderstorm conditions (highest priority)
  if (weatherCode >= 95 && weatherCode <= 99) {
    return 'storm';
  }

  // Snow conditions
  if ((weatherCode >= 71 && weatherCode <= 77) ||
      (weatherCode >= 85 && weatherCode <= 86)) {
    return 'snow';
  }

  // Rain conditions
  if ((weatherCode >= 51 && weatherCode <= 67) ||
      (weatherCode >= 80 && weatherCode <= 82)) {
    return 'rain';
  }

  // Fog conditions (treat as cloudy)
  if (weatherCode >= 45 && weatherCode <= 48) {
    return 'cloudy';
  }

  // Clear/partly cloudy conditions (0-3)
  if (weatherCode >= 0 && weatherCode <= 3) {
    // High wind overrides clear condition
    if (windSpeed > 40) {
      return 'wind';
    }
    return 'clear';
  }

  // Default: assume cloudy for unknown codes
  return 'cloudy';
}
