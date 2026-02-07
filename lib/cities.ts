import type { GeoLocation } from '@/types/weather';

/**
 * Curated list of ~50 cities with geographic, weather, and cultural diversity.
 * Used by the "Surprise me" random city feature.
 */
export const CURATED_CITIES: GeoLocation[] = [
  // Europe
  { name: 'Reykjavik', latitude: 64.1466, longitude: -21.9426, country: 'Iceland', countryCode: 'IS' },
  { name: 'Tromsø', latitude: 69.6496, longitude: 18.9560, country: 'Norway', countryCode: 'NO' },
  { name: 'Tallinn', latitude: 59.4370, longitude: 24.7536, country: 'Estonia', countryCode: 'EE' },
  { name: 'Prague', latitude: 50.0755, longitude: 14.4378, country: 'Czechia', countryCode: 'CZ' },
  { name: 'Dubrovnik', latitude: 42.6507, longitude: 18.0944, country: 'Croatia', countryCode: 'HR' },
  { name: 'Seville', latitude: 37.3891, longitude: -5.9845, country: 'Spain', countryCode: 'ES' },
  { name: 'Edinburgh', latitude: 55.9533, longitude: -3.1883, country: 'United Kingdom', countryCode: 'GB' },
  { name: 'Bergen', latitude: 60.3913, longitude: 5.3221, country: 'Norway', countryCode: 'NO' },

  // Africa
  { name: 'Marrakech', latitude: 31.6295, longitude: -7.9811, country: 'Morocco', countryCode: 'MA' },
  { name: 'Zanzibar', latitude: -6.1659, longitude: 39.2026, country: 'Tanzania', countryCode: 'TZ' },
  { name: 'Cape Town', latitude: -33.9249, longitude: 18.4241, country: 'South Africa', countryCode: 'ZA' },
  { name: 'Nairobi', latitude: -1.2921, longitude: 36.8219, country: 'Kenya', countryCode: 'KE' },
  { name: 'Dakar', latitude: 14.7167, longitude: -17.4677, country: 'Senegal', countryCode: 'SN' },

  // Asia
  { name: 'Kyoto', latitude: 35.0116, longitude: 135.7681, country: 'Japan', countryCode: 'JP' },
  { name: 'Jaipur', latitude: 26.9124, longitude: 75.7873, country: 'India', countryCode: 'IN' },
  { name: 'Hanoi', latitude: 21.0278, longitude: 105.8342, country: 'Vietnam', countryCode: 'VN' },
  { name: 'Seoul', latitude: 37.5665, longitude: 126.9780, country: 'South Korea', countryCode: 'KR' },
  { name: 'Kathmandu', latitude: 27.7172, longitude: 85.3240, country: 'Nepal', countryCode: 'NP' },
  { name: 'Baku', latitude: 40.4093, longitude: 49.8671, country: 'Azerbaijan', countryCode: 'AZ' },
  { name: 'Chiang Mai', latitude: 18.7883, longitude: 98.9853, country: 'Thailand', countryCode: 'TH' },
  { name: 'Ulaanbaatar', latitude: 47.8864, longitude: 106.9057, country: 'Mongolia', countryCode: 'MN' },

  // Middle East
  { name: 'Muscat', latitude: 23.5880, longitude: 58.3829, country: 'Oman', countryCode: 'OM' },
  { name: 'Tbilisi', latitude: 41.7151, longitude: 44.8271, country: 'Georgia', countryCode: 'GE' },
  { name: 'Petra', latitude: 30.3285, longitude: 35.4444, country: 'Jordan', countryCode: 'JO' },

  // South America
  { name: 'Buenos Aires', latitude: -34.6037, longitude: -58.3816, country: 'Argentina', countryCode: 'AR' },
  { name: 'Cartagena', latitude: 10.3910, longitude: -75.5144, country: 'Colombia', countryCode: 'CO' },
  { name: 'Cusco', latitude: -13.5320, longitude: -71.9675, country: 'Peru', countryCode: 'PE' },
  { name: 'Montevideo', latitude: -34.9011, longitude: -56.1645, country: 'Uruguay', countryCode: 'UY' },
  { name: 'Salvador', latitude: -12.9714, longitude: -38.5124, country: 'Brazil', countryCode: 'BR' },
  { name: 'Valparaíso', latitude: -33.0472, longitude: -71.6127, country: 'Chile', countryCode: 'CL' },

  // North America
  { name: 'Havana', latitude: 23.1136, longitude: -82.3666, country: 'Cuba', countryCode: 'CU' },
  { name: 'Oaxaca', latitude: 17.0732, longitude: -96.7266, country: 'Mexico', countryCode: 'MX' },
  { name: 'Anchorage', latitude: 61.2181, longitude: -149.9003, country: 'United States', countryCode: 'US' },
  { name: 'Quebec City', latitude: 46.8139, longitude: -71.2080, country: 'Canada', countryCode: 'CA' },
  { name: 'San Juan', latitude: 18.4655, longitude: -66.1057, country: 'Puerto Rico', countryCode: 'PR' },

  // Oceania
  { name: 'Queenstown', latitude: -45.0312, longitude: 168.6626, country: 'New Zealand', countryCode: 'NZ' },
  { name: 'Hobart', latitude: -42.8821, longitude: 147.3272, country: 'Australia', countryCode: 'AU' },
  { name: 'Fiji', latitude: -17.7134, longitude: 177.9999, country: 'Fiji', countryCode: 'FJ' },

  // Arctic / Extreme
  { name: 'Longyearbyen', latitude: 78.2232, longitude: 15.6267, country: 'Norway', countryCode: 'NO' },
  { name: 'Nuuk', latitude: 64.1750, longitude: -51.7389, country: 'Greenland', countryCode: 'GL' },

  // Islands / Coastal
  { name: 'Santorini', latitude: 36.3932, longitude: 25.4615, country: 'Greece', countryCode: 'GR' },
  { name: 'Lofoten', latitude: 68.2350, longitude: 14.5633, country: 'Norway', countryCode: 'NO' },
  { name: 'Madeira', latitude: 32.6669, longitude: -16.9241, country: 'Portugal', countryCode: 'PT' },
  { name: 'Galápagos', latitude: -0.9538, longitude: -90.9656, country: 'Ecuador', countryCode: 'EC' },

  // Desert / Arid
  { name: 'Atacama', latitude: -23.8634, longitude: -69.1328, country: 'Chile', countryCode: 'CL' },
  { name: 'Merzouga', latitude: 31.0801, longitude: -4.0133, country: 'Morocco', countryCode: 'MA' },

  // Mountain / Highland
  { name: 'Lhasa', latitude: 29.6500, longitude: 91.1000, country: 'China', countryCode: 'CN' },
  { name: 'Quito', latitude: -0.1807, longitude: -78.4678, country: 'Ecuador', countryCode: 'EC' },
  { name: 'Medellín', latitude: 6.2476, longitude: -75.5658, country: 'Colombia', countryCode: 'CO' },
];

/**
 * Pick a random city, avoiding the given name to prevent immediate repeats.
 */
export function getRandomCity(excludeName?: string): GeoLocation {
  const candidates = excludeName
    ? CURATED_CITIES.filter((c) => c.name !== excludeName)
    : CURATED_CITIES;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
