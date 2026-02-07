'use client';

import { useState, useEffect } from 'react';
import type { WeatherData } from '@/types/weather';

interface WeatherInfoProps {
  weather: WeatherData | null;
  isLoading: boolean;
  countryCode: string | null;
}

function countryCodeToFlag(code: string): string {
  return code.toUpperCase().split('').map(
    (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)
  ).join('');
}

function formatTime(isoString: string): string {
  // ISO string like "2026-02-07T08:11" — extract HH:MM
  const match = isoString.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : '';
}

function getLocalTime(utcOffsetSeconds: number): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const localMs = utcMs + utcOffsetSeconds * 1000;
  const local = new Date(localMs);
  return local.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function WeatherInfo({ weather, isLoading, countryCode }: WeatherInfoProps) {
  const [localTime, setLocalTime] = useState<string>('');

  // Update local time every 30 seconds
  useEffect(() => {
    if (!weather) return;
    setLocalTime(getLocalTime(weather.utcOffsetSeconds));
    const interval = setInterval(() => {
      setLocalTime(getLocalTime(weather.utcOffsetSeconds));
    }, 30000);
    return () => clearInterval(interval);
  }, [weather]);

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
  const flag = countryCode ? countryCodeToFlag(countryCode) : '';
  const sunrise = formatTime(weather.sunrise);
  const sunset = formatTime(weather.sunset);

  return (
    <div
      className="fixed top-6 left-6 z-20 transition-opacity duration-300 opacity-0 animate-fade-in"
      role="status"
      aria-live="polite"
      aria-label={`Current weather: ${Math.round(weather.temperature)} degrees Celsius, ${conditionLabel}`}
    >
      <div className="text-white text-shadow-lg">
        <div className="text-3xl md:text-4xl font-light opacity-80">
          {flag && <span className="mr-2">{flag}</span>}
          {Math.round(weather.temperature)}°C
        </div>
        <div className="text-sm md:text-base font-normal opacity-60 mt-1">
          {conditionLabel}
        </div>
        <div className="flex flex-col gap-0.5 mt-2 text-xs opacity-40">
          {localTime && <span>{localTime} local</span>}
          <span>{Math.round(weather.windSpeed)} km/h wind</span>
          {sunrise && sunset && (
            <span>
              ↑ {sunrise}  ↓ {sunset}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
