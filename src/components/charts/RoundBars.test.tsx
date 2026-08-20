// src/components/charts/RoundBars.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RoundBars } from '@/components/charts/RoundBars';

const bars = [
  { key: 's1-0', label: 'Round 1', durationMs: 200_000, verdict: 'pass' as const },
  { key: 's1-1', label: 'Round 2', durationMs: 300_000, verdict: 'miss' as const },
];

describe('RoundBars', () => {
  it('draws one bar per round', () => {
    const { container } = render(<RoundBars caption="Recent rounds" bars={bars} empty="Nothing yet" />);
    expect(container.querySelectorAll('rect.chart__bar')).toHaveLength(2);
  });

  it('tags each bar with its verdict so the palette can colour it', () => {
    const { container } = render(<RoundBars caption="Recent rounds" bars={bars} empty="Nothing yet" />);
    const drawn = [...container.querySelectorAll('rect.chart__bar')].map((r) => r.getAttribute('data-verdict'));
    expect(drawn).toEqual(['pass', 'miss']);
  });

  it('exposes each round time as readable text', () => {
    render(<RoundBars caption="Recent rounds" bars={bars} empty="Nothing yet" />);
    expect(screen.getByRole('row', { name: /Round 1/ })).toHaveTextContent('3:20');
    expect(screen.getByRole('row', { name: /Round 2/ })).toHaveTextContent('5:00');
  });

  it('names the verdict in text rather than relying on colour alone', () => {
    render(<RoundBars caption="Recent rounds" bars={bars} empty="Nothing yet" />);
    expect(screen.getByRole('row', { name: /Round 1/ })).toHaveTextContent('Pass');
    expect(screen.getByRole('row', { name: /Round 2/ })).toHaveTextContent('Miss');
  });

  it('says why it is blank rather than drawing an empty box', () => {
    const { container } = render(<RoundBars caption="Recent rounds" bars={[]} empty="Run a session first" />);
    expect(screen.getByText('Run a session first')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('gives a zero-length round a visible bar rather than an invisible one', () => {
    const { container } = render(
      <RoundBars caption="Recent rounds" bars={[{ ...bars[0], durationMs: 0 }]} empty="Nothing yet" />,
    );
    const height = Number(container.querySelector('rect.chart__bar')?.getAttribute('height'));
    expect(height).toBeGreaterThan(0);
  });
});
