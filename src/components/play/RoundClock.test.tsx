// src/components/play/RoundClock.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoundClock } from '@/components/play/RoundClock';

const GOAL = 240_000;

describe('RoundClock', () => {
  it('renders the elapsed time as m:ss', () => {
    render(<RoundClock elapsedMs={125_000} goalMs={GOAL} paused={false} />);
    expect(screen.getByText('2:05')).toBeInTheDocument();
  });

  it('does not flag over-goal at exactly the goal — the boundary is inclusive', () => {
    const { container } = render(<RoundClock elapsedMs={GOAL} goalMs={GOAL} paused={false} />);
    expect(container.querySelector('.clock')).toHaveAttribute('data-over', 'false');
  });

  it('flags over-goal one millisecond past it', () => {
    const { container } = render(<RoundClock elapsedMs={GOAL + 1} goalMs={GOAL} paused={false} />);
    expect(container.querySelector('.clock')).toHaveAttribute('data-over', 'true');
  });

  it('marks the paused state', () => {
    const { container } = render(<RoundClock elapsedMs={1_000} goalMs={GOAL} paused />);
    expect(container.querySelector('.clock')).toHaveAttribute('data-paused', 'true');
  });

  it('is not a live region — announcing every tick would be hostile', () => {
    const { container } = render(<RoundClock elapsedMs={1_000} goalMs={GOAL} paused={false} />);
    expect(container.querySelector('[aria-live]')).toBeNull();
  });
});
