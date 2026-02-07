'use client';

import { useEffect, useState, useRef } from 'react';
import { getGoogleFontsUrl } from '@/lib/fonts';

interface LandingOverlayProps {
  isVisible: boolean;
}

export default function LandingOverlay({ isVisible }: LandingOverlayProps) {
  const [shouldRender, setShouldRender] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const fontLoaded = useRef(false);

  // Load Cormorant Garamond on mount
  useEffect(() => {
    if (fontLoaded.current) return;
    fontLoaded.current = true;

    const url = getGoogleFontsUrl('Cormorant Garamond');
    if (!url) return;

    const linkId = 'font-landing-cormorant';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = url;
      document.head.appendChild(link);
    }
  }, []);

  // Handle exit animation
  useEffect(() => {
    if (!isVisible && shouldRender && !isExiting) {
      setIsExiting(true);
    }
  }, [isVisible, shouldRender, isExiting]);

  const handleAnimationEnd = () => {
    if (isExiting) {
      setShouldRender(false);
    }
  };

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-x-0 top-[30%] z-10 flex flex-col items-center pointer-events-none"
      style={isExiting ? {
        animation: 'landing-fade-out 600ms ease-out forwards',
      } : {
        animation: 'fade-in 2s ease-out forwards',
      }}
      onAnimationEnd={handleAnimationEnd}
    >
      <h1
        className="text-white/85 text-center"
        style={{
          fontFamily: '"Cormorant Garamond", Georgia, serif',
          fontSize: 'clamp(2.25rem, 5vw, 3rem)',
          fontWeight: 300,
          letterSpacing: '0.12em',
          textShadow: '0 0 40px rgba(120, 90, 180, 0.3)',
        }}
      >
        Weather Mood
      </h1>
      <p
        className="mt-3 text-white/40 text-center uppercase"
        style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: 'clamp(0.75rem, 2vw, 1rem)',
          fontWeight: 300,
          letterSpacing: '0.25em',
        }}
      >
        Feel the weather
      </p>
    </div>
  );
}
