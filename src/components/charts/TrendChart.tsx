import { useId } from 'react';
import { GoalLine } from '@/components/charts/GoalLine';
import { PLOT_HEIGHT, PLOT_WIDTH, PAD_X, PAD_Y, VIEW_HEIGHT, VIEW_WIDTH } from '@/components/charts/box';
import { areaPoints, extentOf, polylinePoints, xFor, yFor } from '@/lib/charts/geometry';
import './charts.css';

export interface TrendPoint {
  readonly label: string;
  readonly value: number;
}

interface TrendChartProps {
  readonly caption: string;
  readonly points: readonly TrendPoint[];
  readonly format: (value: number) => string;
  /** A rule the series is read against, e.g. the goal time. */
  readonly reference?: { readonly value: number; readonly label: string };
  /** Shown instead of an empty frame when there is nothing to plot. */
  readonly empty: string;
}

export function TrendChart({ caption, points, format, reference, empty }: TrendChartProps) {
  const captionId = useId();

  if (points.length === 0) {
    return (
      <figure className="chart">
        <figcaption className="chart__caption" id={captionId}>{caption}</figcaption>
        <p className="chart__empty">{empty}</p>
      </figure>
    );
  }

  const values = points.map((point) => point.value);
  const extent = extentOf(values, reference ? [reference.value] : []);

  return (
    <figure className="chart">
      <figcaption className="chart__caption" id={captionId}>
        {caption}
        {reference && <span className="chart__legend">{reference.label}</span>}
      </figcaption>

      {/* Hidden from assistive tech: the table below carries the same numbers
          in a form a screen reader can actually navigate. */}
      <svg className="chart__svg" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} aria-hidden="true" focusable="false">
        <g transform={`translate(${PAD_X} ${PAD_Y})`}>
          {reference && <GoalLine y={yFor(reference.value, extent, PLOT_HEIGHT)} width={PLOT_WIDTH} />}
          {/* Filled, so the distance from the series to the reference reads as
              a shape rather than as empty chart. */}
          <polygon className="chart__area" points={areaPoints(values, extent, PLOT_WIDTH, PLOT_HEIGHT)} />
          <polyline
            className="chart__line"
            points={polylinePoints(values, extent, PLOT_WIDTH, PLOT_HEIGHT)}
          />
          {values.map((value, index) => (
            <circle
              key={index}
              className="chart__dot"
              cx={xFor(index, values.length, PLOT_WIDTH)}
              cy={yFor(value, extent, PLOT_HEIGHT)}
              r={3}
            />
          ))}
        </g>
      </svg>

      {/* Named by the visible caption rather than repeating it, so the text
          is not read out twice. */}
      <table className="visually-hidden" aria-labelledby={captionId}>
        <thead>
          <tr><th scope="col">When</th><th scope="col">Value</th></tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={index}>
              <th scope="row">{point.label}</th>
              <td>{format(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
