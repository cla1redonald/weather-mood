'use client';

import { useRef, useCallback } from 'react';
import type { GeoLocation } from '@/types/weather';
import { getRandomCity } from '@/lib/cities';

interface RandomCityButtonProps {
  onSelect: (city: GeoLocation) => void;
}

export default function RandomCityButton({ onSelect }: RandomCityButtonProps) {
  const lastCityRef = useRef<string | undefined>(undefined);

  const handleClick = useCallback(() => {
    const city = getRandomCity(lastCityRef.current);
    lastCityRef.current = city.name;
    onSelect(city);
  }, [onSelect]);

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-5 py-2 rounded-full backdrop-blur-xl text-white/60 hover:text-white/80 transition-all duration-300"
      style={{
        background: 'rgba(12, 10, 38, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        fontFamily: '"Cormorant Garamond", Georgia, serif',
        fontWeight: 300,
        fontSize: '0.95rem',
        letterSpacing: '0.08em',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.15)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.08)';
      }}
    >
      {/* Shuffle icon */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 3 21 3 21 8" />
        <line x1="4" y1="20" x2="21" y2="3" />
        <polyline points="21 16 21 21 16 21" />
        <line x1="15" y1="15" x2="21" y2="21" />
        <line x1="4" y1="4" x2="9" y2="9" />
      </svg>
      Surprise me
    </button>
  );
}
