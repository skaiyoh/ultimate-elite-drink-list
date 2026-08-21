import { describe, expect, it } from 'vitest';
import { SEED_CATEGORIES } from '@/data/seed-drinks';
import {
  DEFAULT_DIFFICULTY_ID, DEFAULT_GOAL_MS, DEFAULT_ROUND_COUNT,
  DIFFICULTIES, bandFor, defaultSessionConfig, difficultyLabel,
} from '@/lib/session/config';
import type { DifficultyId } from '@/lib/session/types';

describe('difficulty presets', () => {
  it('carries the three bands the spec fixes', () => {
    expect(DIFFICULTIES.map((d) => [d.id, d.band])).toEqual([
      ['warmup', [8, 11]],
      ['standard', [12, 16]],
      ['rush', [18, 24]],
    ]);
  });

  it('never sets a band floor below the 7 units every round already deals', () => {
    for (const difficulty of DIFFICULTIES) {
      expect(difficulty.band[0]).toBeGreaterThanOrEqual(7);
      expect(difficulty.band[0]).toBeLessThanOrEqual(difficulty.band[1]);
    }
  });

  it('resolves a band by id', () => {
    expect(bandFor('standard')).toEqual([12, 16]);
  });

  it('throws for an unknown difficulty id', () => {
    expect(() => bandFor('impossible' as DifficultyId)).toThrow(/Unknown difficulty/);
  });
});

describe('defaultSessionConfig', () => {
  it('matches the documented defaults', () => {
    expect(defaultSessionConfig()).toEqual({
      roundCount: 5,
      difficultyId: 'standard',
      band: [12, 16],
      goalMs: 240_000,
      categoryIds: ['shot', 'well', 'cocktail', 'martini'],
    });
  });

  it('enables every seeded category', () => {
    expect(defaultSessionConfig().categoryIds).toEqual(SEED_CATEGORIES.map((c) => c.id));
  });

  it('returns a fresh object per call, so callers cannot share mutable state', () => {
    expect(defaultSessionConfig()).not.toBe(defaultSessionConfig());
  });

  it('agrees with the exported default constants', () => {
    const config = defaultSessionConfig();
    expect(config.roundCount).toBe(DEFAULT_ROUND_COUNT);
    expect(config.difficultyId).toBe(DEFAULT_DIFFICULTY_ID);
    expect(config.goalMs).toBe(DEFAULT_GOAL_MS);
  });
});

describe('difficultyLabel', () => {
  it('gives the human label for a known difficulty', () => {
    expect(difficultyLabel('rush')).toBe('Rush');
  });

  it('falls back to the stored id rather than throwing on a retired difficulty', () => {
    // History outlives the presets table. A session saved under a difficulty
    // that has since been renamed away must still render, not crash the screen.
    expect(difficultyLabel('legacy' as never)).toBe('legacy');
  });
});
