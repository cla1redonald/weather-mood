import { GeoLocation } from '@/types/weather';

interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code: string;
  admin1?: string;
}

interface GeocodingResponse {
  results?: GeocodingResult[];
}

/**
 * Search for cities using Open-Meteo Geocoding API
 * Returns up to 5 matching locations
 */
export async function searchCities(query: string): Promise<GeoLocation[]> {
  if (!query.trim()) {
    return [];
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    query
  )}&count=5&language=en&format=json`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      throw new Error(`Geocoding API error: ${response.status}`);
    }

    const data: GeocodingResponse = await response.json();

    if (!data.results || data.results.length === 0) {
      return [];
    }

    // Defensive parsing: validate each result has required fields
    return data.results
      .filter((result) =>
        result.name &&
        typeof result.latitude === 'number' &&
        typeof result.longitude === 'number' &&
        result.country
      )
      .map((result) => ({
        name: result.name,
        latitude: result.latitude,
        longitude: result.longitude,
        country: result.country,
        countryCode: result.country_code || '',
      }));
  } catch (error) {
    console.error('Failed to fetch geocoding data:', error);
    throw error;
  }
}
