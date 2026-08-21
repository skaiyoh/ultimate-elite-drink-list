import { SEED_CATEGORIES } from '@/data/seed-drinks';
import type { CategoryId } from '@/lib/drinks/types';
import type { DifficultyId, SessionConfig } from '@/lib/session/types';

export interface Difficulty {
  readonly id: DifficultyId;
  readonly label: string;
  /** Target total drink units per round — raw drinks, not effort-weighted. */
  readonly band: readonly [number, number];
}

export const DIFFICULTIES: readonly Difficulty[] = [
  { id: 'warmup', label: 'Warm-up', band: [8, 11] },
  { id: 'standard', label: 'Standard', band: [12, 16] },
  { id: 'rush', label: 'Rush', band: [18, 24] },
];

export const DEFAULT_DIFFICULTY_ID: DifficultyId = 'standard';
export const DEFAULT_ROUND_COUNT = 5;
export const DEFAULT_GOAL_MS = 4 * 60 * 1000;
export const MIN_GOAL_MS = 60 * 1000;
export const MAX_GOAL_MS = 15 * 60 * 1000;
export const GOAL_STEP_MS = 15 * 1000;
export const MIN_ROUND_COUNT = 1;
export const MAX_ROUND_COUNT = 20;

export function bandFor(id: DifficultyId): readonly [number, number] {
  const found = DIFFICULTIES.find((d) => d.id === id);
  if (!found) throw new Error(`Unknown difficulty: ${id}`);
  return found.band;
}

export function defaultSessionConfig(): SessionConfig {
  return {
    roundCount: DEFAULT_ROUND_COUNT,
    difficultyId: DEFAULT_DIFFICULTY_ID,
    band: bandFor(DEFAULT_DIFFICULTY_ID),
    goalMs: DEFAULT_GOAL_MS,
    categoryIds: SEED_CATEGORIES.map((c) => c.id) as CategoryId[],
  };
}

/**
 * Display name for a difficulty. Unlike `bandFor`, this never throws: it is
 * called with ids read back from stored history, which outlives this table.
 */
export function difficultyLabel(id: DifficultyId): string {
  return DIFFICULTIES.find((d) => d.id === id)?.label ?? id;
}
