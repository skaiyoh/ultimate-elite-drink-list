// src/components/charts/TrendChart.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrendChart } from '@/components/charts/TrendChart';
import { formatDuration } from '@/lib/format/duration';

const points = [
  { label: 'Mar 1', value: 200_000 },
  { label: 'Mar 2', value: 180_000 },
];

describe('TrendChart', () => {
  it('captions the figure', () => {
    render(<TrendChart caption="Session average" points={points} format={formatDuration} empty="Nothing yet" />);
    expect(screen.getByText('Session average')).toBeInTheDocument();
  });

  it('exposes every plotted value as readable text, not just as a shape', () => {
    render(<TrendChart caption="Session average" points={points} format={formatDuration} empty="Nothing yet" />);
    expect(screen.getByRole('row', { name: /Mar 1/ })).toHaveTextContent('3:20');
    expect(screen.getByRole('row', { name: /Mar 2/ })).toHaveTextContent('3:00');
  });

  it('draws a graphic when there is something to plot', () => {
    const { container } = render(
      <TrendChart caption="Session average" points={points} format={formatDuration} empty="Nothing yet" />,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('hides the graphic from assistive tech, which reads the table instead', () => {
    const { container } = render(
      <TrendChart caption="Session average" points={points} format={formatDuration} empty="Nothing yet" />,
    );
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('says why it is blank rather than drawing an empty box', () => {
    const { container } = render(
      <TrendChart caption="Session average" points={[]} format={formatDuration} empty="Run a session first" />,
    );
    expect(screen.getByText('Run a session first')).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('labels the reference line when one is given', () => {
    render(
      <TrendChart
        caption="Session average"
        points={points}
        format={formatDuration}
        reference={{ value: 240_000, label: 'Goal 4:00' }}
        empty="Nothing yet"
      />,
    );
    expect(screen.getByText('Goal 4:00')).toBeInTheDocument();
  });

  it('omits the reference line when none is given', () => {
    const { container } = render(
      <TrendChart caption="Pace" points={points} format={formatDuration} empty="Nothing yet" />,
    );
    expect(container.querySelector('.chart__reference')).not.toBeInTheDocument();
  });

  it('plots a single session without collapsing the line', () => {
    const { container } = render(
      <TrendChart caption="Session average" points={[points[0]]} format={formatDuration} empty="Nothing yet" />,
    );
    expect(container.querySelector('polyline')).toHaveAttribute('points', expect.stringContaining(','));
  });
});
