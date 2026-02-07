import { WeatherData, NormalizedParams } from '@/types/weather';

/**
 * Normalize weather parameters to 0-1 range for visual/audio mapping
 *
 * Normalization ranges:
 * - Temperature: -20°C (0.0) to 45°C (1.0)
 * - Humidity: 0% (0.0) to 100% (1.0)
 * - Wind speed: 0 km/h (0.0) to 100 km/h (1.0)
 * - Cloud cover: 0% (0.0) to 100% (1.0)
 */
export function normalizeParams(weather: WeatherData): NormalizedParams {
  // Temperature: -20°C to 45°C
  const tempMin = -20;
  const tempMax = 45;
  const temperature = Math.max(
    0,
    Math.min(1, (weather.temperature - tempMin) / (tempMax - tempMin))
  );

  // Humidity: 0-100% (direct percentage to 0-1)
  const humidity = Math.max(0, Math.min(1, weather.humidity / 100));

  // Wind speed: 0-100 km/h (cap at 1.0)
  const windSpeed = Math.max(0, Math.min(1, weather.windSpeed / 100));

  // Cloud cover: 0-100% (direct percentage to 0-1)
  const cloudCover = Math.max(0, Math.min(1, weather.cloudCover / 100));

  return {
    temperature,
    humidity,
    windSpeed,
    cloudCover,
  };
}
