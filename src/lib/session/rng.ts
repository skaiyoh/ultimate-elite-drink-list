
/** Returns a float in [0, 1). Injected everywhere so tests are deterministic. */
export type Rng = () => number;

export const systemRng: Rng = () => Math.random();

/** Linear congruential generator — small, fast, and reproducible across runs. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

/** Fisher-Yates over a fresh copy — the input array is never mutated. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}
