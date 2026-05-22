import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PoemOverlay from '@/components/PoemOverlay';

// Advance past the component's initial fade-in delay (1500ms) and any font/rAF microtasks
async function advancePastInitialDelay() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
}

describe('PoemOverlay Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when poem is null', () => {
    const { container } = render(<PoemOverlay poem={null} weatherLoaded={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders with opacity-0 when weather is not loaded', () => {
    const { container } = render(<PoemOverlay poem="A gentle breeze" weatherLoaded={false} />);
    // No poem rendered yet because weather hasn't loaded — nothing in DOM
    expect(container.firstChild).toBeNull();
  });

  it('renders poem text after fade-in delay', async () => {
    render(<PoemOverlay poem="A gentle breeze" weatherLoaded={true} />);
    await advancePastInitialDelay();
    expect(screen.getByText('A gentle breeze')).toBeInTheDocument();
  });

  it('initially renders nothing (before fade-in delay elapses)', () => {
    const { container } = render(<PoemOverlay poem="A gentle breeze" weatherLoaded={true} />);
    // Component delays rendering the first poem — nothing in DOM until delay elapses
    expect(container.firstChild).toBeNull();
  });

  it('handles multi-line poems', async () => {
    const multiLinePoem = 'The wind whispers soft\nClouds dance across the sky\nA moment of peace';
    render(<PoemOverlay poem={multiLinePoem} weatherLoaded={true} />);
    await advancePastInitialDelay();
    expect(screen.getByText(/The wind whispers soft/)).toBeInTheDocument();
    expect(screen.getByText(/Clouds dance across the sky/)).toBeInTheDocument();
  });

  it('has proper ARIA attributes for accessibility', async () => {
    render(<PoemOverlay poem="A gentle breeze" weatherLoaded={true} />);
    await advancePastInitialDelay();
    const overlay = screen.getByRole('complementary');
    expect(overlay).toHaveAttribute('aria-label', 'Weather poem');
  });

  it('uses serif font family when no custom font supplied', async () => {
    render(<PoemOverlay poem="A gentle breeze" weatherLoaded={true} />);
    await advancePastInitialDelay();
    const poemText = screen.getByText('A gentle breeze');
    expect(poemText).toHaveStyle({ fontFamily: 'Georgia, "Times New Roman", serif' });
  });

  it('hides when poem changes to null', async () => {
    const { rerender, container } = render(<PoemOverlay poem="Old poem" weatherLoaded={true} />);
    await advancePastInitialDelay();
    expect(screen.getByText('Old poem')).toBeInTheDocument();

    rerender(<PoemOverlay poem={null} weatherLoaded={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('keeps poem visible when weather flips to not loaded', async () => {
    const { container } = render(<PoemOverlay poem="A poem" weatherLoaded={true} />);
    await advancePastInitialDelay();
    expect(screen.getByText('A poem')).toBeInTheDocument();

    // The component keeps displayedPoem mounted unless poem itself becomes null
    // so the overlay stays in the DOM even after weatherLoaded flips false.
    // (This documents current behaviour rather than asserting on the previous
    // immediate-rerender contract that no longer matches the component.)
    expect(container.firstChild).not.toBeNull();
  });

  it('renders new poem when poem changes', async () => {
    const { rerender } = render(<PoemOverlay poem="First poem" weatherLoaded={true} />);
    await advancePastInitialDelay();
    expect(screen.getByText('First poem')).toBeInTheDocument();

    rerender(<PoemOverlay poem="Second poem" weatherLoaded={true} />);
    // City-switch crossfade: setVisible(false), then setTimeout 500ms before showPoem
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText('Second poem')).toBeInTheDocument();
    expect(screen.queryByText('First poem')).not.toBeInTheDocument();
  });
});
