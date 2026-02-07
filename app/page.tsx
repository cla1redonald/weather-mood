'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { GeoLocation, WeatherData, NormalizedParams, WeatherCondition } from '@/types/weather';
import type { SoundscapeProfile, VisualProfile } from '@/types/mood';
import { fetchWeather } from '@/lib/weather/api';
import { normalizeParams } from '@/lib/weather/params';
import WeatherCanvas from '@/components/WeatherCanvas';
import CitySearch from '@/components/CitySearch';
import WeatherInfo from '@/components/WeatherInfo';
import MuteToggle from '@/components/MuteToggle';
import PoemOverlay from '@/components/PoemOverlay';
import { useWeatherAudio } from '@/hooks/useWeatherAudio';
import { useElevenLabsAudio } from '@/hooks/useElevenLabsAudio';

const SYNTH_DUCKED_VOLUME = 0; // Synth fully silent when ElevenLabs audio is playing — let the real music breathe
const SYNTH_FULL_VOLUME = 1.0;

function HomeContent() {
  const searchParams = useSearchParams();
  const [selectedCity, setSelectedCity] = useState<GeoLocation | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [normalizedParams, setNormalizedParams] = useState<NormalizedParams | null>(null);
  const [condition, setCondition] = useState<WeatherCondition | null>(null);
  const [poem, setPoem] = useState<string | null>(null);
  const [soundProfile, setSoundProfile] = useState<SoundscapeProfile | null>(null);
  const [visualProfile, setVisualProfile] = useState<VisualProfile | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [isPoemLoading, setIsPoemLoading] = useState(false);
  const [weatherLoaded, setWeatherLoaded] = useState(false);

  // Audio hooks
  const { mute: muteSynth, unmute: unmuteSynth, isMuted: isSynthMuted, startOnGesture, setVolume: setSynthVolume } =
    useWeatherAudio(normalizedParams, condition, soundProfile);
  const elevenLabs = useElevenLabsAudio();

  // Unified mute state (both synth and ElevenLabs mute together)
  const isMuted = isSynthMuted;

  // Duck synth when ElevenLabs audio arrives
  useEffect(() => {
    if (elevenLabs.hasAudio && !isMuted) {
      setSynthVolume(SYNTH_DUCKED_VOLUME);
    } else if (!elevenLabs.hasAudio) {
      setSynthVolume(SYNTH_FULL_VOLUME);
    }
  }, [elevenLabs.hasAudio, isMuted, setSynthVolume]);

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
    setSoundProfile(null); // Clear old profiles
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
      setIsPoemLoading(true);
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
          }),
          signal: controller.signal,
        });

        if (response.ok) {
          const data = await response.json();
          if (!controller.signal.aborted) {
            setPoem(data.poem);
            if (data.sound) setSoundProfile(data.sound);
            if (data.visual) setVisualProfile(data.visual);

            // Trigger ElevenLabs audio (music + SFX + narration) in parallel
            elevenLabs.fetchAll({
              city: city.name,
              condition: weather.condition,
              temperature: weather.temperature,
              poem: data.poem,
              soundDescription: data.sound?.description || '',
              voice: data.voice,
            });
          }
        } else {
          console.error('Mood API error:', response.status, await response.text().catch(() => ''));
        }
      } catch (error: unknown) {
        if ((error as Error)?.name !== 'AbortError') {
          console.error('Failed to fetch mood:', error);
        }
        // Silently fail - parametric visuals and audio still work
      } finally {
        if (!controller.signal.aborted) {
          setIsPoemLoading(false);
        }
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

  // Handle city selection — also auto-starts audio (user gesture)
  const handleCitySelect = useCallback(
    (city: GeoLocation) => {
      setSelectedCity(city);
      startOnGesture(); // Resume AudioContext from this click gesture
      loadWeatherForCity(city);
    },
    [loadWeatherForCity, startOnGesture]
  );

  // Unified mute toggle — controls both synth and ElevenLabs
  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      unmuteSynth();
      elevenLabs.unmute();
    } else {
      muteSynth();
      elevenLabs.mute();
    }
  }, [isMuted, muteSynth, unmuteSynth, elevenLabs]);

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
      <WeatherCanvas condition={condition} params={normalizedParams} visualProfile={visualProfile} />

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
