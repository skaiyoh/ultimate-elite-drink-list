'use client';
import { useEffect, useState } from 'react';

/**
 * False on the server and during the first client render. Gate every read of
 * localStorage behind this so server and client markup never disagree.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  // This *is* the hydration-guard idiom: a deliberate one-time flip after
  // mount so client markup can diverge from the server-rendered pass. There
  // is no external store to subscribe to instead — eslint-plugin-react-hooks
  // 7's set-state-in-effect rule doesn't have a case for this pattern.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
