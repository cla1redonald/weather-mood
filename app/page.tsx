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
import LoadingOverlay from '@/components/LoadingOverlay';
import LandingOverlay from '@/components/LandingOverlay';
import { useElevenLabsAudio } from '@/hooks/useElevenLabsAudio';
import { useLandingAudio } from '@/hooks/useLandingAudio';
import { LANDING_VISUAL_PROFILE } from '@/lib/canvas/landingProfile';

function HomeContent() {
  const searchParams = useSearchParams();
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [normalizedParams, setNormalizedParams] = useState<NormalizedParams | null>(null);
  const [condition, setCondition] = useState<WeatherCondition | null>(null);
  const [poem, setPoem] = useState<string | null>(null);
  const [visualProfile, setVisualProfile] = useState<VisualProfile | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadingCity, setLoadingCity] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [fontFamily, setFontFamily] = useState<string | null>(null);
  const [weatherLoaded, setWeatherLoaded] = useState(false);
  const [isLanding, setIsLanding] = useState(true);

  // Audio — ElevenLabs only (synth removed)
  const elevenLabs = useElevenLabsAudio();
  const isMuted = elevenLabs.isMuted;

  // Landing ambient audio
  const landingAudio = useLandingAudio();
  const landingAudioStartedRef = useRef(false);

  // Start landing audio on first user gesture (respects autoplay policy)
  useEffect(() => {
    if (!isLanding) return;

    const handleGesture = () => {
      if (!landingAudioStartedRef.current) {
        landingAudioStartedRef.current = true;
        landingAudio.startAudio();
      }
    };

    document.addEventListener('click', handleGesture, { once: true });
    document.addEventListener('keydown', handleGesture, { once: true });

    return () => {
      document.removeEventListener('click', handleGesture);
      document.removeEventListener('keydown', handleGesture);
    };
  }, [isLanding, landingAudio]);

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

    // Exit landing state and fade out landing audio
    setIsLanding(false);
    landingAudio.fadeOut();

    setIsLoadingWeather(true);
    setIsTransitioning(true);
    setLoadingCity(city.name);
    setCountryCode(city.countryCode);
    setWeatherLoaded(false);

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
            setIsTransitioning(false);
            setLoadingCity(null);
            setPoem(data.poem);
            if (data.fontFamily) setFontFamily(data.fontFamily);
            if (data.visual) setVisualProfile(data.visual);

            // Trigger ElevenLabs audio (music + SFX + narration) in parallel
            elevenLabs.fetchAll({
              poem: data.poem,
              poemLocal: data.poemLocal || data.poem,
              voice: data.voice,
              languageCode: data.languageCode || undefined,
              musicDirection: data.musicDirection || '',
              ambienceDirection: data.ambienceDirection || '',
            });
          }
        } else {
          console.error('Mood API error:', response.status, await response.text().catch(() => ''));
          setIsTransitioning(false);
          setLoadingCity(null);
        }
      } catch (error: unknown) {
        if ((error as Error)?.name !== 'AbortError') {
          console.error('Failed to fetch mood:', error);
          setIsTransitioning(false);
          setLoadingCity(null);
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
      // Ignore when typing in an input (e.g. city search)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
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
      {/* Layer 1: Canvas (z-0) — shows landing profile until city loads */}
      <WeatherCanvas
        condition={condition}
        params={normalizedParams}
        visualProfile={visualProfile ?? ((isLanding || isTransitioning) ? LANDING_VISUAL_PROFILE : null)}
        isAudioLoading={elevenLabs.isLoading}
        isTransitioning={isTransitioning}
      />

      {/* Layer 2: Landing Overlay (z-10) — title + tagline */}
      <LandingOverlay isVisible={isLanding && !isTransitioning} />

      {/* Layer 3: Loading Overlay (z-10) — prominent centered indicator */}
      <LoadingOverlay cityName={loadingCity} isVisible={isTransitioning} />

      {/* Layer 4: Poem Overlay (z-10) */}
      <PoemOverlay poem={poem} weatherLoaded={weatherLoaded} isTransitioning={isTransitioning} fontFamily={fontFamily} />

      {/* Layer 5: UI Controls (z-20+) */}
      <WeatherInfo weather={weatherData} isLoading={isLoadingWeather} countryCode={countryCode} />
      <CitySearch onCitySelect={handleCitySelect} onRandomCity={handleCitySelect} defaultCity={defaultCity} />
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
