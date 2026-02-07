/**
 * Weather condition categories mapped from WMO weather codes
 */
export type WeatherCondition = 'rain' | 'snow' | 'clear' | 'cloudy' | 'storm' | 'wind';

/**
 * Geographic location data from Open-Meteo geocoding API
 */
export interface GeoLocation {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
}

/**
 * Weather data from Open-Meteo API
 */
export interface WeatherData {
  temperature: number;        // Celsius
  humidity: number;           // Percentage (0-100)
  windSpeed: number;          // km/h
  windDirection: number;      // Degrees (0-360)
  cloudCover: number;         // Percentage (0-100)
  weatherCode: number;        // WMO weather code
  uvIndex: number;            // UV index (0-11+)
  condition: WeatherCondition;
}

/**
 * Normalized weather parameters (all values 0-1) for visual/audio mapping
 */
export interface NormalizedParams {
  temperature: number;  // 0 = cold, 1 = hot
  humidity: number;     // 0 = dry, 1 = humid
  windSpeed: number;    // 0 = calm, 1 = gale
  cloudCover: number;   // 0 = clear, 1 = overcast
}
