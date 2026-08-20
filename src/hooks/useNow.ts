'use client';
import { useEffect, useState } from 'react';

/**
 * A clock reading that refreshes while `active`. Display only — every recorded
 * value comes from Date.now() at the instant of the action, never from here.
 */
export function useNow(active: boolean, intervalMs = 100): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    // Resync immediately on activation rather than waiting for the first
    // interval tick: without this, a round that just started (or resumed)
    // would render against a `now` reading that is stale by up to
    // `intervalMs`. The interval below is the ongoing subscription; this is
    // the one synchronous catch-up eslint-plugin-react-hooks 7's
    // set-state-in-effect rule doesn't have a case for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);

  return now;
}
