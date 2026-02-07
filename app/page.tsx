'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { GeoLocation, WeatherData, NormalizedParams, WeatherCondition } from '@/types/weather';
import type { VisualProfile } from '@/types/mood';
import { fetchWeather } from '@/lib/weather/api';
import { normalizeParams } from '@/lib/weather/params';
import WeatherCanvas from '@/components/WeatherCanvas';
import CitySearch from '@/components/CitySearch';
import WeatherInfo from '@/components/WeatherInfo';
import MuteToggle from '@/components/MuteToggle';
import PoemOverlay from '@/components/PoemOverlay';
import { useElevenLabsAudio } from '@/hooks/useElevenLabsAudio';

function HomeContent() {
  const searchParams = useSearchParams();
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [normalizedParams, setNormalizedParams] = useState<NormalizedParams | null>(null);
  const [condition, setCondition] = useState<WeatherCondition | null>(null);
  const [poem, setPoem] = useState<string | null>(null);
  const [visualProfile, setVisualProfile] = useState<VisualProfile | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [weatherLoaded, setWeatherLoaded] = useState(false);

  // Audio — ElevenLabs only (synth removed)
  const elevenLabs = useElevenLabsAudio();
  const isMuted = elevenLabs.isMuted;

  // Ref to track abort controller for cancelling previous requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch weather when city is selected
  const loadWeatherForCity = useCallback(async (city: GeoLocation) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoadingWeather(true);
    setWeatherLoaded(false);
    setPoem(null); // Fade out old poem immediately
    setVisualProfile(null);

    try {
      const weather = await fetchWeather(city.latitude, city.longitude);

      // Check if this request was cancelled
      if (controller.signal.aborted) {
        return;
      }

      const params = normalizeParams(weather);

      setWeatherData(weather);
      setCondition(weather.condition);
      setNormalizedParams(params);
      setWeatherLoaded(true);

      // Update URL with city query param
      const url = new URL(window.location.href);
      url.searchParams.set('city', city.name);
      window.history.pushState({}, '', url);

      // Fetch mood (poem + sound profile + visual profile)
      try {
        const response = await fetch('/api/mood', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city: city.name,
            temperature: weather.temperature,
            condition: weather.condition,
            humidity: weather.humidity,
            windSpeed: weather.windSpeed,
            cloudCover: weather.cloudCover,
            weatherCode: weather.weatherCode,
            windDirection: weather.windDirection,
            uvIndex: weather.uvIndex,
          }),
          signal: controller.signal,
        });

        if (response.ok) {
          const data = await response.json();
          if (!controller.signal.aborted) {
            setPoem(data.poem);
            if (data.visual) setVisualProfile(data.visual);

            // Trigger ElevenLabs audio (music + SFX + narration) in parallel
            elevenLabs.fetchAll({
              poem: data.poem,
              voice: data.voice,
              musicDirection: data.musicDirection || '',
              ambienceDirection: data.ambienceDirection || '',
            });
          }
        } else {
          console.error('Mood API error:', response.status, await response.text().catch(() => ''));
        }
      } catch (error: unknown) {
        if ((error as Error)?.name !== 'AbortError') {
          console.error('Failed to fetch mood:', error);
        }
        // Silently fail - parametric visuals still work
      }
    } catch (error: unknown) {
      if ((error as Error)?.name !== 'AbortError') {
        console.error('Failed to fetch weather:', error);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingWeather(false);
      }
    }
  }, [elevenLabs]);

  // Handle city selection
  const handleCitySelect = loadWeatherForCity;

  // Mute toggle — ElevenLabs audio only
  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      elevenLabs.unmute();
    } else {
      elevenLabs.mute();
    }
  }, [isMuted, elevenLabs]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleMute]);

  // Get default city from URL query param
  const defaultCity = searchParams?.get('city') || undefined;

  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden bg-black">
      {/* Layer 1: Canvas (z-0) */}
      <WeatherCanvas condition={condition} params={normalizedParams} visualProfile={visualProfile} isAudioLoading={elevenLabs.isLoading} />

      {/* Layer 2: Poem Overlay (z-10) */}
      <PoemOverlay poem={poem} weatherLoaded={weatherLoaded} />

      {/* Layer 4: UI Controls (z-20+) */}
      <WeatherInfo weather={weatherData} isLoading={isLoadingWeather} />
      <CitySearch onCitySelect={handleCitySelect} defaultCity={defaultCity} />
      <MuteToggle isMuted={isMuted} onToggle={handleToggleMute} />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="fixed inset-0 w-screen h-screen bg-black" />}>
      <HomeContent />
    </Suspense>
  );
}
