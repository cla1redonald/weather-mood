'use client';

import type { CritiqueTickerState } from '@/hooks/useSelfCritique';

interface CritiqueTickerProps {
  state: CritiqueTickerState;
  onSkip: () => void;
}

/**
 * A small line under the search bar narrating Claude's review of its own
 * canvas: "Round 2 of 3: the grey feels flat for a humid afternoon, adding
 * amber". Three dots show rounds done; Skip stops the loop.
 */
export default function CritiqueTicker({ state, onSkip }: CritiqueTickerProps) {
  if (state.phase === 'idle') return null;

  const running = state.phase === 'running';

  return (
    <div
      className="fixed top-52 lg:top-[5.5rem] left-1/2 -translate-x-1/2 z-20 w-[calc(100%-2rem)] max-w-[560px]"
      style={{ animation: 'fade-in 0.6s ease-out both' }}
    >
      <div
        className="flex items-center gap-3 rounded-2xl pl-4 pr-1.5 py-1.5 backdrop-blur-xl"
        style={{
          background: 'linear-gradient(135deg, rgba(12, 10, 38, 0.5) 0%, rgba(28, 18, 52, 0.4) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
        }}
      >
        <ol className="flex gap-1.5 shrink-0" aria-label={`${state.roundsCompleted} of ${state.maxRounds} rounds done`}>
          {Array.from({ length: state.maxRounds }, (_, i) => {
            const done = i < state.roundsCompleted;
            const current = running && i === state.round - 1 && !done;
            return (
              <li
                key={i}
                className={[
                  'w-1.5 h-1.5 rounded-full',
                  done ? 'bg-white/80' : 'bg-white/20',
                  current ? 'motion-safe:animate-pulse bg-white/50' : '',
                ].join(' ')}
              />
            );
          })}
        </ol>

        <p className="flex-1 min-w-0 py-2 text-sm leading-snug text-white/85" role="status" aria-live="polite">
          {state.message}
          {state.note && <span className="block text-white/55 text-xs mt-0.5">{state.note}</span>}
        </p>

        {running && (
          <button
            type="button"
            onClick={onSkip}
            className="shrink-0 min-h-[44px] min-w-[44px] px-3 rounded-xl text-xs uppercase tracking-wider text-white/60 hover:text-white hover:bg-white/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/60 transition-colors"
            aria-label="Skip Claude's revisions"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
