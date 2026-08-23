import type { CategoryId, DrinkId } from '@/lib/drinks/types';

/** Lives here rather than in config.ts: SessionConfig needs it, and config.ts
 *  needs SessionConfig, which would otherwise be a circular import. */
export type DifficultyId = 'warmup' | 'standard' | 'rush';

/** One line on a dealt ticket. `name` is snapshotted so history survives renames. */
export interface TicketLine {
  readonly drinkId: DrinkId;
  readonly name: string;
  readonly categoryId: CategoryId;
  readonly quantity: number;
}

export interface RoundRecord {
  readonly index: number;
  readonly ticket: readonly TicketLine[];
  readonly totalUnits: number;
  readonly startedAt: number;
  readonly endedAt: number;
  readonly pausedMs: number;
  /** endedAt - startedAt - pausedMs */
  readonly durationMs: number;
}

export interface SessionConfig {
  readonly roundCount: number;
  readonly difficultyId: DifficultyId;
  readonly band: readonly [number, number];
  readonly goalMs: number;
  readonly categoryIds: readonly CategoryId[];
}

export interface SessionRecord {
  readonly id: string;
  readonly startedAt: number;
  /** null means ended early — kept and shown, marked as such. */
  readonly completedAt: number | null;
  readonly config: SessionConfig;
  readonly rounds: readonly RoundRecord[];
}
