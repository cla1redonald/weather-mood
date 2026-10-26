'use client';

import { useEffect, useState, useRef } from 'react';
import { getGoogleFontsUrl } from '@/lib/fonts';

interface LoadingOverlayProps {
  cityName: string | null;
  isVisible: boolean;
}

export default function LoadingOverlay({ cityName, isVisible }: LoadingOverlayProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const fontLoaded = useRef(false);

  // Load Cormorant Garamond (same as landing)
  useEffect(() => {
    if (fontLoaded.current) return;
    fontLoaded.current = true;
    const url = getGoogleFontsUrl('Cormorant Garamond');
    if (!url) return;
    const linkId = 'font-loading-cormorant';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = url;
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (isVisible && cityName) {
      setShouldRender(true);
      setIsExiting(false);
    } else if (!isVisible && shouldRender) {
      setIsExiting(true);
    }
  }, [isVisible, cityName, shouldRender]);

  const handleAnimationEnd = () => {
    if (isExiting) {
      setShouldRender(false);
      setIsExiting(false);
    }
  };

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-x-0 top-[30%] z-10 flex flex-col items-center pointer-events-none"
      style={isExiting ? {
        animation: 'loading-fade-out 800ms ease-out forwards',
      } : {
        animation: 'fade-in 800ms ease-out 300ms both',
      }}
      onAnimationEnd={handleAnimationEnd}
    >
      {/* Breathing glow ring */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: '1.5px solid rgba(255, 255, 255, 0.12)',
          animation: 'glow-breathe 3s ease-in-out infinite',
        }}
      />

      {/* City name */}
      <p
        className="mt-6 text-white/85 text-center"
        style={{
          fontFamily: '"Cormorant Garamond", Georgia, serif',
          fontSize: 'clamp(1.5rem, 3.5vw, 2rem)',
          fontWeight: 300,
          letterSpacing: '0.12em',
          textShadow: '0 0 40px rgba(120, 90, 180, 0.3)',
        }}
      >
        {cityName}
      </p>

      {/* Subtitle */}
      <p
        className="mt-2 text-white/35 text-center uppercase"
        style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: 'clamp(0.625rem, 1.5vw, 0.75rem)',
          fontWeight: 300,
          letterSpacing: '0.25em',
        }}
      >
        Reading the weather
      </p>
    </div>
  );
}
