'use client';

import { useState, useEffect } from 'react';
import type { WeatherData } from '@/types/weather';

interface WeatherInfoProps {
  weather: WeatherData | null;
  isLoading: boolean;
  countryCode: string | null;
  languageCode: string | null;
}

function getLanguageDisplayName(code: string): string | null {
  if (!code || code === 'en') return null;
  try {
    // Display the language in its own script (e.g. "Français", "日本語")
    const display = new Intl.DisplayNames([code], { type: 'language' });
    const name = display.of(code);
    if (!name || name === code) return null;
    // Capitalize first letter
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return null;
  }
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

export default function WeatherInfo({ weather, isLoading, countryCode, languageCode }: WeatherInfoProps) {
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
  const flagUrl = countryCode
    ? `https://hatscripts.github.io/circle-flags/flags/${countryCode.toLowerCase()}.svg`
    : null;
  const sunrise = formatTime(weather.sunrise);
  const sunset = formatTime(weather.sunset);
  const langName = languageCode ? getLanguageDisplayName(languageCode) : null;

  return (
    <div
      className="fixed top-6 left-6 z-20 opacity-0"
      style={{
        animation: 'fade-in 1.2s ease-out 500ms both',
      }}
      role="status"
      aria-live="polite"
      aria-label={`Current weather: ${Math.round(weather.temperature)} degrees Celsius, ${conditionLabel}`}
    >
      <div className="text-white" style={{ textShadow: '0 0 30px rgba(120, 90, 180, 0.25), 0 2px 8px rgba(0, 0, 0, 0.4)' }}>
        <div className="text-3xl md:text-4xl font-light opacity-80 flex items-center gap-2.5" style={{ letterSpacing: '0.04em' }}>
          {flagUrl && (
            <img
              src={flagUrl}
              alt=""
              className="w-6 h-6 md:w-7 md:h-7 opacity-70 drop-shadow-md"
              style={{ filter: 'saturate(0.8)' }}
            />
          )}
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
          {langName && <span>{langName}</span>}
        </div>
      </div>
    </div>
  );
}
