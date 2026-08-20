// src/components/play/RestCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RestCard } from '@/components/play/RestCard';
import type { RoundRecord } from '@/lib/session/types';

const GOAL = 240_000;

const round = (durationMs: number): RoundRecord => ({
  index: 1,
  ticket: [{ drinkId: 'a', name: 'A', categoryId: 'shot', quantity: 4 }],
  totalUnits: 4,
  startedAt: 0,
  endedAt: durationMs,
  pausedMs: 0,
  durationMs,
});

describe('RestCard', () => {
  it('marks a round under the goal as a pass', () => {
    const { container } = render(<RestCard round={round(200_000)} goalMs={GOAL} averageMs={200_000} />);
    expect(container.querySelector('.rest')).toHaveAttribute('data-verdict', 'pass');
  });

  it('passes at exactly the goal', () => {
    const { container } = render(<RestCard round={round(GOAL)} goalMs={GOAL} averageMs={GOAL} />);
    expect(container.querySelector('.rest')).toHaveAttribute('data-verdict', 'pass');
  });

  it('marks a round over the goal as a miss', () => {
    const { container } = render(<RestCard round={round(GOAL + 1)} goalMs={GOAL} averageMs={GOAL + 1} />);
    expect(container.querySelector('.rest')).toHaveAttribute('data-verdict', 'miss');
  });

  it('names the round by its human number, not its index', () => {
    render(<RestCard round={round(200_000)} goalMs={GOAL} averageMs={200_000} />);
    expect(screen.getByRole('heading', { name: 'Round 2 done' })).toBeInTheDocument();
  });

  it('shows a dash rather than a number when there is no average yet', () => {
    render(<RestCard round={round(200_000)} goalMs={GOAL} averageMs={null} />);
    expect(screen.getByText(/Average so far/)).toHaveTextContent('—');
  });
});
