import { describe, expect, it } from 'vitest';
import { extentOf, polylinePoints, xFor, yFor } from '@/lib/charts/geometry';

describe('extentOf', () => {
  it('spans the values it is given', () => {
    expect(extentOf([10, 30, 20])).toEqual({ min: 10, max: 30 });
  });

  it('widens a flat series so it cannot divide by zero', () => {
    const extent = extentOf([5, 5, 5]);
    expect(extent.max).toBeGreaterThan(extent.min);
    expect(extent.min).toBeLessThanOrEqual(5);
    expect(extent.max).toBeGreaterThanOrEqual(5);
  });

  it('widens a single value the same way', () => {
    const extent = extentOf([7]);
    expect(extent.max).toBeGreaterThan(extent.min);
  });

  it('stays non-degenerate with no values at all', () => {
    const extent = extentOf([]);
    expect(extent.max).toBeGreaterThan(extent.min);
  });

  it('stretches to include a reference value below the series', () => {
    expect(extentOf([10, 20], [0])).toEqual({ min: 0, max: 20 });
  });

  it('stretches to include a reference value above the series', () => {
    expect(extentOf([10, 20], [50])).toEqual({ min: 10, max: 50 });
  });

  it('ignores a reference value already inside the range', () => {
    expect(extentOf([10, 20], [15])).toEqual({ min: 10, max: 20 });
  });

  it('handles a flat series sitting exactly on its reference', () => {
    const extent = extentOf([5, 5], [5]);
    expect(extent.max).toBeGreaterThan(extent.min);
  });
});

describe('yFor', () => {
  const extent = { min: 0, max: 100 };

  it('puts the maximum at the top of the box', () => {
    expect(yFor(100, extent, 200)).toBe(0);
  });

  it('puts the minimum at the bottom of the box', () => {
    expect(yFor(0, extent, 200)).toBe(200);
  });

  it('interpolates linearly in between', () => {
    expect(yFor(25, extent, 200)).toBe(150);
  });

  it('clamps a value below the extent to the floor', () => {
    expect(yFor(-50, extent, 200)).toBe(200);
  });

  it('clamps a value above the extent to the ceiling', () => {
    expect(yFor(150, extent, 200)).toBe(0);
  });
});

describe('xFor', () => {
  it('centres a lone point rather than pinning it to the left edge', () => {
    expect(xFor(0, 1, 100)).toBe(50);
  });

  it('spans edge to edge for several points', () => {
    expect(xFor(0, 3, 100)).toBe(0);
    expect(xFor(1, 3, 100)).toBe(50);
    expect(xFor(2, 3, 100)).toBe(100);
  });
});

describe('polylinePoints', () => {
  it('renders SVG point pairs', () => {
    expect(polylinePoints([0, 100], { min: 0, max: 100 }, 100, 50)).toBe('0,50 100,0');
  });

  it('is empty for an empty series, so the polyline renders nothing', () => {
    expect(polylinePoints([], { min: 0, max: 1 }, 100, 50)).toBe('');
  });

  it('rounds to keep the markup small', () => {
    expect(polylinePoints([33], { min: 0, max: 100 }, 100, 100)).toBe('50,67');
  });
});
