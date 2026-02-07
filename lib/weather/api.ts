import { WeatherData } from '@/types/weather';
import { classifyWeather } from './classifier';

interface OpenMeteoCurrentWeather {
  temperature_2m: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  cloud_cover: number;
  weather_code: number;
  uv_index: number;
}

interface OpenMeteoResponse {
  current: OpenMeteoCurrentWeather;
}

/**
 * Fetch current weather data from Open-Meteo API
 */
export async function fetchWeather(
  latitude: number,
  longitude: number
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'wind_speed_10m',
      'wind_direction_10m',
      'cloud_cover',
      'weather_code',
      'uv_index',
    ].join(','),
  });

  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data: OpenMeteoResponse = await response.json();

    // Defensive parsing: ensure all required fields exist
    if (!data.current) {
      throw new Error('Invalid weather data: missing current conditions');
    }

    const current = data.current;

    // Validate required fields and provide defaults for optional ones
    const temperature = typeof current.temperature_2m === 'number' ? current.temperature_2m : 15;
    const humidity = typeof current.relative_humidity_2m === 'number' ? current.relative_humidity_2m : 50;
    const windSpeed = typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : 0;
    const windDirection = typeof current.wind_direction_10m === 'number' ? current.wind_direction_10m : 0;
    const cloudCover = typeof current.cloud_cover === 'number' ? current.cloud_cover : 0;
    const weatherCode = typeof current.weather_code === 'number' ? current.weather_code : 0;
    const uvIndex = typeof current.uv_index === 'number' ? current.uv_index : 0;

    const weatherData: WeatherData = {
      temperature,
      humidity,
      windSpeed,
      windDirection,
      cloudCover,
      weatherCode,
      uvIndex,
      condition: classifyWeather(weatherCode, windSpeed),
    };

    return weatherData;
  } catch (error) {
    console.error('Failed to fetch weather data:', error);
    throw error;
  }
}
