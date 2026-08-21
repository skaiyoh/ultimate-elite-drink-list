interface GoalLineProps {
  readonly y: number;
  readonly width: number;
}

/**
 * The dashed reference rule inside a chart. Carries no text: the whole graphic
 * is hidden from assistive tech, so the label lives in the figure caption where
 * it is actually readable.
 */
export function GoalLine({ y, width }: GoalLineProps) {
  return <line className="chart__reference" x1={0} x2={width} y1={y} y2={y} />;
}
