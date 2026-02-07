'use client';

import { useState, useEffect } from 'react';

interface MuteToggleProps {
  isMuted: boolean;
  onToggle: () => void;
}

export default function MuteToggle({ isMuted, onToggle }: MuteToggleProps) {
  const [showHint, setShowHint] = useState(false);

  // Show subtle pulse hint on first load if muted
  useEffect(() => {
    if (isMuted) {
      const timer = setTimeout(() => {
        setShowHint(true);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setShowHint(false);
    }
  }, [isMuted]);

  return (
    <button
      onClick={onToggle}
      className={[
        'fixed bottom-6 right-6 z-20 w-11 h-11',
        'flex items-center justify-center',
        'backdrop-blur-xl rounded-full',
        'transition-all duration-300',
        'group',
      ].join(' ')}
      style={{
        background: 'rgba(12, 10, 38, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: showHint && isMuted ? undefined : '0 4px 16px rgba(0, 0, 0, 0.2)',
        animation: showHint && isMuted ? 'mute-glow-hint 2.5s ease-in-out infinite' : undefined,
      }}
      aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
    >
      {isMuted ? (
        <svg
          className="w-6 h-6 text-white opacity-60 group-hover:opacity-100 transition-opacity"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
          />
        </svg>
      ) : (
        <svg
          className="w-6 h-6 text-white opacity-60 group-hover:opacity-100 transition-opacity"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
          />
        </svg>
      )}
    </button>
  );
}
