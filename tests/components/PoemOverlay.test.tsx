import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import PoemOverlay from '@/components/PoemOverlay';

describe('PoemOverlay Component', () => {
  it('renders nothing when poem is null', () => {
    const { container } = render(<PoemOverlay poem={null} weatherLoaded={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders with opacity-0 when weather is not loaded', () => {
    const { container } = render(<PoemOverlay poem="A gentle breeze" weatherLoaded={false} />);
    const overlay = container.firstChild as HTMLElement;
    // Poem is rendered but invisible
    expect(overlay).toHaveClass('opacity-0');
  });

  it('renders poem text when both poem and weatherLoaded are true', () => {
    render(<PoemOverlay poem="A gentle breeze" weatherLoaded={true} />);
    expect(screen.getByText('A gentle breeze')).toBeInTheDocument();
  });

  it('initially renders with opacity-0', () => {
    const { container } = render(<PoemOverlay poem="A gentle breeze" weatherLoaded={true} />);
    const overlay = container.firstChild as HTMLElement;

    // Initially invisible (will fade in after delay)
    expect(overlay).toHaveClass('opacity-0');
  });

  it('handles multi-line poems', () => {
    const multiLinePoem = 'The wind whispers soft\\nClouds dance across the sky\\nA moment of peace';

    render(<PoemOverlay poem={multiLinePoem} weatherLoaded={true} />);
    // Poem text should be in the document
    expect(screen.getByText(/The wind whispers soft/)).toBeInTheDocument();
    expect(screen.getByText(/Clouds dance across the sky/)).toBeInTheDocument();
  });

  it('has proper ARIA attributes for accessibility', () => {
    render(<PoemOverlay poem="A gentle breeze" weatherLoaded={true} />);
    const overlay = screen.getByRole('complementary');

    expect(overlay).toHaveAttribute('aria-label', 'Weather poem');
  });

  it('uses serif font family', () => {
    render(<PoemOverlay poem="A gentle breeze" weatherLoaded={true} />);
    const poemText = screen.getByText('A gentle breeze');

    expect(poemText).toHaveStyle({ fontFamily: 'Georgia, "Times New Roman", serif' });
  });

  it('hides when poem changes to null', () => {
    const { rerender, container } = render(<PoemOverlay poem="Old poem" weatherLoaded={true} />);

    // Poem is rendered
    expect(screen.getByText('Old poem')).toBeInTheDocument();

    // Poem changes to null
    rerender(<PoemOverlay poem={null} weatherLoaded={true} />);

    // Should be removed from DOM
    expect(container.firstChild).toBeNull();
  });

  it('resets visibility when weather is not loaded', () => {
    const { rerender, container } = render(<PoemOverlay poem="A poem" weatherLoaded={true} />);

    // Poem is rendered
    expect(screen.getByText('A poem')).toBeInTheDocument();

    // Weather loading state
    rerender(<PoemOverlay poem="A poem" weatherLoaded={false} />);

    // Should still be rendered but with opacity-0
    const overlay = container.firstChild as HTMLElement;
    expect(overlay).toHaveClass('opacity-0');
  });

  it('renders new poem when poem changes', () => {
    const { rerender } = render(<PoemOverlay poem="First poem" weatherLoaded={true} />);
    expect(screen.getByText('First poem')).toBeInTheDocument();

    // New poem arrives
    rerender(<PoemOverlay poem="Second poem" weatherLoaded={true} />);
    expect(screen.getByText('Second poem')).toBeInTheDocument();
    expect(screen.queryByText('First poem')).not.toBeInTheDocument();
  });
});
