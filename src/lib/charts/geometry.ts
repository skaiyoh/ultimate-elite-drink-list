/**
 * The arithmetic behind the hand-rolled SVG charts (spec §8). Kept out of the
 * components so the parts that can divide by zero are unit-testable without a
 * DOM: a flat series, a single point, and an empty series all reach these.
 */

export interface Extent {
  readonly min: number;
  readonly max: number;
}

/** Widens a zero-height range; 10% of the value, or 1 when the value is 0. */
function widen(value: number): Extent {
  const padding = Math.abs(value) * 0.1 || 1;
  return { min: value - padding, max: value + padding };
}

/**
 * The value range an axis must cover. `mustInclude` carries reference values
 * such as the goal line, which has to stay on screen even when every session
 * beat it comfortably.
 */
export function extentOf(values: readonly number[], mustInclude: readonly number[] = []): Extent {
  const all = [...values, ...mustInclude];
  if (all.length === 0) return { min: 0, max: 1 };

  const min = Math.min(...all);
  const max = Math.max(...all);
  return min === max ? widen(min) : { min, max };
}

/** SVG y grows downward, so the maximum sits at 0 and the minimum at `height`. */
export function yFor(value: number, extent: Extent, height: number): number {
  const ratio = (value - extent.min) / (extent.max - extent.min);
  return height * (1 - Math.min(1, Math.max(0, ratio)));
}

/** Evenly spaced across the full width; a lone point is centred, not pinned left. */
export function xFor(index: number, count: number, width: number): number {
  return count <= 1 ? width / 2 : (index / (count - 1)) * width;
}

/** `<polyline points>` for a series. Empty in, empty out — the line just vanishes. */
export function polylinePoints(
  values: readonly number[], extent: Extent, width: number, height: number,
): string {
  return values
    .map((value, index) =>
      `${Math.round(xFor(index, values.length, width))},${Math.round(yFor(value, extent, height))}`)
    .join(' ');
}

/**
 * The same series as `polylinePoints`, closed down to the baseline so it can be
 * filled. The fill turns the gap between a series and its reference line into a
 * readable shape — on the trend chart, that gap is how far under goal you are,
 * which is the thing worth seeing.
 */
export function areaPoints(
  values: readonly number[], extent: Extent, width: number, height: number,
): string {
  const line = polylinePoints(values, extent, width, height);
  if (line === '') return '';

  const first = Math.round(xFor(0, values.length, width));
  const last = Math.round(xFor(values.length - 1, values.length, width));
  const floor = Math.round(height);
  return `${first},${floor} ${line} ${last},${floor}`;
}
