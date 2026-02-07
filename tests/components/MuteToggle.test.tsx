import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import MuteToggle from '@/components/MuteToggle';

describe('MuteToggle Component', () => {
  const mockOnToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with muted state', () => {
    render(<MuteToggle isMuted={true} onToggle={mockOnToggle} />);
    const button = screen.getByRole('button', { name: /unmute audio/i });
    expect(button).toBeInTheDocument();
  });

  it('renders with unmuted state', () => {
    render(<MuteToggle isMuted={false} onToggle={mockOnToggle} />);
    const button = screen.getByRole('button', { name: /mute audio/i });
    expect(button).toBeInTheDocument();
  });

  it('calls onToggle when clicked', () => {
    render(<MuteToggle isMuted={true} onToggle={mockOnToggle} />);
    const button = screen.getByRole('button');

    fireEvent.click(button);

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onToggle multiple times', () => {
    render(<MuteToggle isMuted={true} onToggle={mockOnToggle} />);
    const button = screen.getByRole('button');

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mockOnToggle).toHaveBeenCalledTimes(3);
  });

  it('does not show pulse animation when unmuted', () => {
    const { container } = render(<MuteToggle isMuted={false} onToggle={mockOnToggle} />);
    const button = container.querySelector('button');

    vi.advanceTimersByTime(3000);

    expect(button).not.toHaveClass('animate-pulse');
  });

  it('shows muted icon when muted', () => {
    render(<MuteToggle isMuted={true} onToggle={mockOnToggle} />);
    // Check that an SVG icon exists
    const svg = screen.getByRole('button').querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('shows unmuted icon when unmuted', () => {
    render(<MuteToggle isMuted={false} onToggle={mockOnToggle} />);
    // Check that an SVG icon exists
    const svg = screen.getByRole('button').querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('has correct accessibility attributes', () => {
    render(<MuteToggle isMuted={true} onToggle={mockOnToggle} />);
    const button = screen.getByRole('button');

    expect(button).toHaveAttribute('aria-label', 'Unmute audio');
  });

  it('updates accessibility label when state changes', () => {
    const { rerender } = render(<MuteToggle isMuted={true} onToggle={mockOnToggle} />);
    let button = screen.getByRole('button');

    expect(button).toHaveAttribute('aria-label', 'Unmute audio');

    rerender(<MuteToggle isMuted={false} onToggle={mockOnToggle} />);
    button = screen.getByRole('button');

    expect(button).toHaveAttribute('aria-label', 'Mute audio');
  });
});
