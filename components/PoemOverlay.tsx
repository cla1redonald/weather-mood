'use client';

import { useEffect, useState } from 'react';

interface PoemOverlayProps {
  /** The poem text to display, or null if no poem available */
  poem: string | null;
  /** Whether weather data has loaded (controls the fade-in delay) */
  weatherLoaded: boolean;
}

export default function PoemOverlay({ poem, weatherLoaded }: PoemOverlayProps) {
  const [visible, setVisible] = useState(false);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!poem || !weatherLoaded) {
      setVisible(false);
      return;
    }

    // Delay 3 seconds after weather loads, then fade in
    // Use shorter delay if reduced motion is preferred
    const delay = prefersReducedMotion ? 1000 : 3000;
    const timer = setTimeout(() => {
      setVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [poem, weatherLoaded, prefersReducedMotion]);

  // Don't render at all if there's no poem
  if (!poem) return null;

  // Adjust transition duration based on reduced motion preference
  const transitionDuration = prefersReducedMotion ? 'duration-300' : 'duration-[2000ms]';

  return (
    <div
      className={[
        'fixed bottom-12 left-1/2 -translate-x-1/2 z-10',
        'max-w-[480px] w-[calc(100%-2rem)]',
        'bg-black/30 backdrop-blur-lg rounded-xl',
        'px-8 py-6',
        `transition-opacity ${transitionDuration} ease-in`,
        visible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
      role="complementary"
      aria-label="Weather poem"
    >
      <p
        className="text-white/90 text-center text-lg leading-[1.8] whitespace-pre-line"
        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
      >
        {poem}
      </p>
    </div>
  );
}
