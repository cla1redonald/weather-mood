'use client';

import type { WeatherData } from '@/types/weather';

interface WeatherInfoProps {
  weather: WeatherData | null;
  isLoading: boolean;
}

export default function WeatherInfo({ weather, isLoading }: WeatherInfoProps) {
  if (!weather && !isLoading) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="fixed top-6 left-6 z-20">
        <div className="animate-pulse">
          <div className="h-8 w-16 bg-white/20 rounded mb-1" />
          <div className="h-4 w-12 bg-white/20 rounded" />
        </div>
      </div>
    );
  }

  if (!weather) return null;

  const conditionLabel = weather.condition.charAt(0).toUpperCase() + weather.condition.slice(1);

  return (
    <div
      className="fixed top-6 left-6 z-20 transition-opacity duration-300 opacity-0 animate-fade-in"
      role="status"
      aria-live="polite"
      aria-label={`Current weather: ${Math.round(weather.temperature)} degrees Celsius, ${conditionLabel}`}
    >
      <div className="text-white text-shadow-lg">
        <div className="text-3xl md:text-4xl font-light opacity-80">
          {Math.round(weather.temperature)}°C
        </div>
        <div className="text-sm md:text-base font-normal opacity-60 mt-1">
          {conditionLabel}
        </div>
      </div>
    </div>
  );
}
