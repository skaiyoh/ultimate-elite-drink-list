'use client';
import { useEffect } from 'react';

/** Best-effort. Unsupported or denied is silent — the drill works without it. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: { release(): Promise<void> } | null = null;
    let cancelled = false;

    navigator.wakeLock
      .request('screen')
      .then((lock) => {
        if (cancelled) { void lock.release(); return; }
        sentinel = lock;
      })
      .catch(() => { /* denied */ });

    return () => {
      cancelled = true;
      void sentinel?.release();
    };
  }, [active]);
}
