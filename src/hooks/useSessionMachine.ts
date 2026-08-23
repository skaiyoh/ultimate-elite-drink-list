'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNow } from '@/hooks/useNow';
import { useWakeLock } from '@/hooks/useWakeLock';
import { categoryMap, loadDrinkList, poolFor } from '@/lib/drinks/repository';
import type { DrinkListState } from '@/lib/drinks/types';
import { dealRound } from '@/lib/session/generator';
import {
  elapsedMs as computeElapsed, sessionReducer, toRecord,
  type SessionAction, type SessionState,
} from '@/lib/session/machine';
import { averageMs } from '@/lib/session/metrics';
import { systemRng } from '@/lib/session/rng';
import {
  clearActiveSession, loadActiveSession, saveActiveSession, saveLastRun,
} from '@/lib/session/repository';
import type { RoundRecord } from '@/lib/session/types';
import type { WriteOutcome } from '@/lib/storage/localStore';

export interface SessionMachine {
  readonly hydrated: boolean;
  readonly state: SessionState | null;
  readonly elapsedMs: number;
  readonly averageMs: number | null;
  readonly lastRound: RoundRecord | null;
  /**
   * Non-null when the last write failed.
   * Derived from WriteOutcome rather than restated, so it cannot drift from it.
   * Two separate stale-union bugs in this plan came from restating a type by hand.
   */
  readonly storageWarning: Exclude<WriteOutcome, 'ok'> | null;
  startRound(): void;
  pause(): void;
  resume(): void;
  advance(): void;
  end(): void;
  /** Scraps the run: nothing is recorded, and the backup is discarded. */
  startOver(): void;
}

export function useSessionMachine(): SessionMachine {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<SessionState | null>(null);
  const [storageWarning, setStorageWarning] = useState<Exclude<WriteOutcome, 'ok'> | null>(null);
  const stateRef = useRef<SessionState | null>(null);
  const drinksRef = useRef<DrinkListState | null>(null);

  useEffect(() => {
    const restored = loadActiveSession();
    stateRef.current = restored;
    drinksRef.current = loadDrinkList();
    // Same deliberate one-time-after-mount hydration idiom as useHydrated and
    // the setup screen: a single effect that loads the persisted snapshot and
    // flips hydrated, not a subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(restored);
    setHydrated(true);
  }, []);

  // Persistence happens here rather than inside a state updater: React may
  // invoke an updater twice in development, which would commit twice.
  const apply = useCallback((action: SessionAction) => {
    const previous = stateRef.current;
    if (previous === null) return;

    const next = sessionReducer(previous, action);
    if (next === previous) return;

    stateRef.current = next;
    let outcome;
    if (next.status === 'complete') {
      outcome = saveLastRun(toRecord(next));
      // Only clear the crash-recovery backup once the write actually lands —
      // if it fails (e.g. quota), the backup is the only copy of every
      // completed round, and deleting it here would destroy the run React
      // still has rendered on screen.
      //
      // Refreshed rather than merely kept, because "kept" left it a round
      // short: the last round is only ever written through saveLastRun, so a
      // backup last touched by the previous action holds the run minus the
      // round that just finished. /play replaces the route immediately after
      // this, so whatever is in the slot now is the whole of what survives.
      // Its own outcome is discarded on purpose — the failure worth reporting
      // is that the run was not saved, which `outcome` already carries.
      if (outcome === 'ok') clearActiveSession();
      else saveActiveSession(next);
    } else {
      outcome = saveActiveSession(next);
    }
    setStorageWarning(outcome === 'ok' ? null : outcome);
    setState(next);
  }, []);

  const startRound = useCallback(() => {
    const previous = stateRef.current;
    const drinks = drinksRef.current;
    if (previous === null || drinks === null) return;

    const pool = poolFor(drinks, previous.config.categoryIds);
    const last = previous.rounds[previous.rounds.length - 1];
    const dealtLastRound = last ? last.ticket.map((line) => line.drinkId) : [];
    const ticket = dealRound(pool, categoryMap(), previous.config.band, dealtLastRound, systemRng);

    apply({ type: 'startRound', ticket, at: Date.now() });
  }, [apply]);

  const pause = useCallback(() => apply({ type: 'pause', at: Date.now() }), [apply]);
  const resume = useCallback(() => apply({ type: 'resume', at: Date.now() }), [apply]);
  const advance = useCallback(() => apply({ type: 'advance', at: Date.now() }), [apply]);
  const end = useCallback(() => apply({ type: 'end', at: Date.now() }), [apply]);

  const startOver = useCallback(() => {
    // Deliberately not routed through `apply`: every other action persists
    // what it produces, and the whole point of this one is that nothing about
    // the scrapped run is written anywhere.
    clearActiveSession();
    stateRef.current = null;
    setStorageWarning(null);
    setState(null);
  }, []);

  const running = state?.status === 'running';
  // The ticker stops while paused, and that is safe: elapsedMs cancels `now`
  // out entirely once pausedAt is set, so a stale reading still renders right.
  const now = useNow(running);
  useWakeLock(running);

  return {
    hydrated,
    state,
    elapsedMs: state?.current ? computeElapsed(state.current, now) : 0,
    averageMs: state ? averageMs(state.rounds) : null,
    lastRound: state && state.rounds.length > 0 ? state.rounds[state.rounds.length - 1] : null,
    storageWarning,
    startRound, pause, resume, advance, end, startOver,
  };
}
