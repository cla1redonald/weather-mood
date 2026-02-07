'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { FONT_CONFIG, getGoogleFontsUrl } from '@/lib/fonts';

interface PoemOverlayProps {
  poem: string | null;
  weatherLoaded: boolean;
  isTransitioning?: boolean;
  fontFamily?: string | null;
}

const loadedFonts = new Set<string>();

function loadFont(fontFamily: string): Promise<void> {
  if (loadedFonts.has(fontFamily)) return Promise.resolve();

  const url = getGoogleFontsUrl(fontFamily);
  if (!url) return Promise.resolve();

  // Inject <link> if not already present
  const linkId = `font-${fontFamily.replace(/\s+/g, '-')}`;
  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
  }

  const config = FONT_CONFIG[fontFamily];
  if (!config) return Promise.resolve();

  // Wait for font to be ready
  return document.fonts.load(`${config.weight} ${config.size} ${config.family}`)
    .then(() => { loadedFonts.add(fontFamily); })
    .catch(() => { loadedFonts.add(fontFamily); }); // proceed even if load fails
}

export default function PoemOverlay({ poem, weatherLoaded, isTransitioning, fontFamily }: PoemOverlayProps) {
  const [displayedPoem, setDisplayedPoem] = useState<string | null>(null);
  const [displayedFont, setDisplayedFont] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [transitionMs, setTransitionMs] = useState(2000);
  const prevPoemRef = useRef<string | null>(null);

  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const showPoem = useCallback((newPoem: string, newFont: string | null, fadeInMs: number) => {
    const doShow = () => {
      setDisplayedPoem(newPoem);
      setDisplayedFont(newFont);
      setTransitionMs(fadeInMs);
      requestAnimationFrame(() => setVisible(true));
    };

    if (newFont) {
      loadFont(newFont).then(doShow);
    } else {
      doShow();
    }
  }, []);

  useEffect(() => {
    if (!poem || !weatherLoaded) {
      if (!poem) {
        setVisible(false);
        setDisplayedPoem(null);
        setDisplayedFont(null);
        prevPoemRef.current = null;
      }
      return;
    }

    // First poem ever
    if (prevPoemRef.current === null) {
      prevPoemRef.current = poem;
      const delay = prefersReducedMotion ? 500 : 1500;
      const fadeIn = prefersReducedMotion ? 300 : 2000;
      const timer = setTimeout(() => showPoem(poem, fontFamily ?? null, fadeIn), delay);
      return () => clearTimeout(timer);
    }

    // Same poem — no-op
    if (poem === prevPoemRef.current) return;

    // City switch: crossfade
    prevPoemRef.current = poem;
    setTransitionMs(prefersReducedMotion ? 200 : 500);
    setVisible(false);

    const timer = setTimeout(() => {
      showPoem(poem, fontFamily ?? null, prefersReducedMotion ? 300 : 1000);
    }, prefersReducedMotion ? 200 : 500);

    return () => clearTimeout(timer);
  }, [poem, weatherLoaded, fontFamily, prefersReducedMotion, showPoem]);

  if (!displayedPoem) return null;

  let opacityClass = 'opacity-0';
  if (visible) {
    opacityClass = isTransitioning ? 'opacity-20' : 'opacity-100';
  }

  // Look up per-font styles
  const config = displayedFont ? FONT_CONFIG[displayedFont] : null;
  const fontStyle = config
    ? { fontFamily: `${config.family}, Georgia, serif`, fontSize: config.size, fontWeight: config.weight, letterSpacing: config.letterSpacing }
    : { fontFamily: 'Georgia, "Times New Roman", serif' };

  return (
    <div
      className={[
        'fixed bottom-12 left-1/2 -translate-x-1/2 z-10',
        'max-w-[480px] w-[calc(100%-2rem)] min-h-[180px]',
        'bg-black/30 backdrop-blur-lg rounded-xl',
        'px-8 py-6',
        'transition-opacity ease-in',
        opacityClass,
      ].join(' ')}
      style={{ transitionDuration: `${transitionMs}ms` }}
      role="complementary"
      aria-label="Weather poem"
    >
      <p
        className="text-white/90 text-center leading-[1.8] whitespace-pre-line"
        style={fontStyle}
      >
        {displayedPoem}
      </p>
    </div>
  );
}
