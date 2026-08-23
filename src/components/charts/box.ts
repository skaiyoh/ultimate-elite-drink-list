/**
 * The chart coordinate space. One chart uses it today; it stays a module of its
 * own so a second would share the frame rather than drift a few pixels off the
 * first. The SVG scales with CSS; these are viewBox units, not device pixels.
 */
export const VIEW_WIDTH = 600;
// Deliberately wide: rendered at the page's full width, a 3:1 box came out
// nearly 300px tall and read as empty space with a line in it.
export const VIEW_HEIGHT = 132;

/** Room for the dots and the topmost bar cap to sit inside the frame. */
export const PAD_X = 8;
export const PAD_Y = 10;

export const PLOT_WIDTH = VIEW_WIDTH - PAD_X * 2;
export const PLOT_HEIGHT = VIEW_HEIGHT - PAD_Y * 2;
