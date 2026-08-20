'use client';
import { useHydrated } from '@/hooks/useHydrated';
import { isPersistent } from '@/lib/storage/localStore';
import './ui.css';

/**
 * Shown when localStorage threw on access — private browsing, blocked storage.
 * The app keeps working from an in-memory fallback, but nothing survives a
 * reload, and the bartender deserves to know before drilling for twenty minutes.
 */
export function StorageBanner() {
  const hydrated = useHydrated();
  if (!hydrated || isPersistent()) return null;

  return (
    <p className="banner" role="status">
      This browser is blocking local storage, so sessions and profiles won&apos;t be saved.
    </p>
  );
}
