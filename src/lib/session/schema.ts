import { z } from 'zod';
import { categoryIdSchema } from '@/lib/drinks/schema';
import { DIFFICULTIES } from '@/lib/session/config';
import type { SessionState } from '@/lib/session/machine';
import type { DifficultyId, SessionConfig, SessionRecord } from '@/lib/session/types';

const difficultyIds = DIFFICULTIES.map((d) => d.id) as [DifficultyId, ...DifficultyId[]];

const ticketLineSchema = z.object({
  drinkId: z.string().min(1),
  name: z.string().min(1),
  categoryId: categoryIdSchema,
  quantity: z.number().int().positive(),
});

const roundRecordSchema = z.object({
  index: z.number().int().nonnegative(),
  ticket: z.array(ticketLineSchema),
  totalUnits: z.number().int().nonnegative(),
  startedAt: z.number(),
  endedAt: z.number(),
  pausedMs: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
});

export const sessionConfigSchema = z.object({
  roundCount: z.number().int().positive(),
  difficultyId: z.enum(difficultyIds),
  band: z.tuple([z.number().int(), z.number().int()]),
  goalMs: z.number().int().positive(),
  categoryIds: z.array(categoryIdSchema),
});

const activeRoundSchema = z.object({
  index: z.number().int().nonnegative(),
  ticket: z.array(ticketLineSchema),
  totalUnits: z.number().int().nonnegative(),
  startedAt: z.number(),
  pausedMs: z.number().nonnegative(),
  pausedAt: z.number().nullable(),
});

export const sessionRecordSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  startedAt: z.number(),
  completedAt: z.number().nullable(),
  config: sessionConfigSchema,
  rounds: z.array(roundRecordSchema),
});

export const sessionStateSchema = sessionRecordSchema.extend({
  status: z.enum(['resting', 'running', 'paused', 'complete']),  // mirrors SessionStatus
  current: activeRoundSchema.nullable(),
});

export function parseSessionConfig(raw: unknown): SessionConfig | null {
  const result = sessionConfigSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseSessionRecord(raw: unknown): SessionRecord | null {
  const result = sessionRecordSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function parseSessionState(raw: unknown): SessionState | null {
  const result = sessionStateSchema.safeParse(raw);
  return result.success ? result.data : null;
}
