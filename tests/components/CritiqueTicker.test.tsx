import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CritiqueTicker from '@/components/CritiqueTicker';
import type { CritiqueTickerState } from '@/hooks/useSelfCritique';

const running: CritiqueTickerState = {
  phase: 'running',
  round: 2,
  roundsCompleted: 1,
  maxRounds: 3,
  message: 'Round 2 of 3: the grey feels flat for a humid afternoon, adding amber',
  note: null,
};

describe('CritiqueTicker', () => {
  it('renders nothing when idle', () => {
    const { container } = render(<CritiqueTicker state={{ ...running, phase: 'idle' }} onSkip={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the round and the critique in a polite live region', () => {
    render(<CritiqueTicker state={running} onSkip={vi.fn()} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Round 2 of 3: the grey feels flat for a humid afternoon, adding amber');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByLabelText('1 of 3 rounds done')).toBeInTheDocument();
  });

  it('has a keyboard-reachable Skip button that calls onSkip', async () => {
    const onSkip = vi.fn();
    render(<CritiqueTicker state={running} onSkip={onSkip} />);

    await userEvent.tab();
    expect(screen.getByRole('button', { name: "Skip Claude's revisions" })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('shows the closing note and drops Skip once done', () => {
    render(<CritiqueTicker state={{ ...running, phase: 'done', roundsCompleted: 3, note: 'Done after 3 rounds.' }} onSkip={vi.fn()} />);
    expect(screen.getByText('Done after 3 rounds.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
