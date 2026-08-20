import { useId } from 'react';
import { PLOT_HEIGHT, PLOT_WIDTH, PAD_X, PAD_Y, VIEW_HEIGHT, VIEW_WIDTH } from '@/components/charts/box';
import { extentOf, yFor } from '@/lib/charts/geometry';
import { formatDuration } from '@/lib/format/duration';
import './charts.css';

export interface RoundBar {
  readonly key: string;
  readonly label: string;
  readonly durationMs: number;
  readonly verdict: 'pass' | 'miss';
}

interface RoundBarsProps {
  readonly caption: string;
  readonly bars: readonly RoundBar[];
  readonly empty: string;
}

/** So a round that somehow recorded no time is still a mark on the chart. */
const MIN_BAR = 2;
/** Fraction of each slot the bar fills; the rest is the gap to its neighbour. */
const FILL = 0.72;

export function RoundBars({ caption, bars, empty }: RoundBarsProps) {
  const captionId = useId();

  if (bars.length === 0) {
    return (
      <figure className="chart">
        <figcaption className="chart__caption" id={captionId}>{caption}</figcaption>
        <p className="chart__empty">{empty}</p>
      </figure>
    );
  }

  // Bars are read against zero, not against the fastest round — a bar chart
  // that starts partway up exaggerates every difference between rounds.
  const extent = extentOf(bars.map((bar) => bar.durationMs), [0]);
  const slot = PLOT_WIDTH / bars.length;
  const barWidth = slot * FILL;

  return (
    <figure className="chart">
      <figcaption className="chart__caption" id={captionId}>{caption}</figcaption>

      <svg className="chart__svg" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} aria-hidden="true" focusable="false">
        <g transform={`translate(${PAD_X} ${PAD_Y})`}>
          {bars.map((bar, index) => {
            const y = yFor(bar.durationMs, extent, PLOT_HEIGHT);
            const height = Math.max(MIN_BAR, PLOT_HEIGHT - y);
            return (
              <rect
                key={bar.key}
                className="chart__bar"
                data-verdict={bar.verdict}
                x={index * slot + (slot - barWidth) / 2}
                y={PLOT_HEIGHT - height}
                width={barWidth}
                height={height}
              />
            );
          })}
        </g>
      </svg>

      {/* Named by the visible caption rather than repeating it, so the text
          is not read out twice. */}
      <table className="visually-hidden" aria-labelledby={captionId}>
        <thead>
          <tr><th scope="col">Round</th><th scope="col">Time</th><th scope="col">Result</th></tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.key}>
              <th scope="row">{bar.label}</th>
              <td>{formatDuration(bar.durationMs)}</td>
              {/* Named, not just coloured: colour alone is not an accessible signal. */}
              <td>{bar.verdict === 'pass' ? 'Pass' : 'Miss'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
