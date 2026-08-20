'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  addProfile, loadActiveProfileId, loadProfiles, removeProfile,
  renameProfile, saveActiveProfileId, saveProfiles,
} from '@/lib/profiles/repository';
import type { Profile } from '@/lib/profiles/types';

export interface ProfileContextValue {
  readonly hydrated: boolean;
  readonly profiles: readonly Profile[];
  readonly activeProfile: Profile | null;
  create(name: string): void;
  select(id: string | null): void;
  rename(id: string, name: string): void;
  remove(id: string): void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [profiles, setProfiles] = useState<readonly Profile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    // Same deliberate one-time-after-mount flip as useHydrated — this loads
    // the persisted snapshot and marks it hydrated in a single effect so
    // there is exactly one extra client render, not three.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfiles(loadProfiles());
    setActiveId(loadActiveProfileId());
    setHydrated(true);
  }, []);

  const select = useCallback((id: string | null) => {
    setActiveId(id);
    saveActiveProfileId(id);
  }, []);

  const commit = useCallback((next: Profile[]) => {
    setProfiles(next);
    saveProfiles(next);
  }, []);

  const create = useCallback((name: string) => {
    const trimmed = name.trim();
    if (trimmed === '') return;
    const id = crypto.randomUUID();
    commit(addProfile(profiles, trimmed, id, Date.now()));
    select(id);
  }, [commit, profiles, select]);

  const rename = useCallback((id: string, name: string) => {
    if (name.trim() === '') return;
    commit(renameProfile(profiles, id, name));
  }, [commit, profiles]);

  const remove = useCallback((id: string) => {
    commit(removeProfile(profiles, id));
    if (activeId === id) select(null);
  }, [activeId, commit, profiles, select]);

  const value = useMemo<ProfileContextValue>(() => ({
    hydrated,
    profiles,
    activeProfile: profiles.find((p) => p.id === activeId) ?? null,
    create, select, rename, remove,
  }), [activeId, create, hydrated, profiles, remove, rename, select]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfiles(): ProfileContextValue {
  const value = useContext(ProfileContext);
  if (value === null) throw new Error('useProfiles must be used inside a ProfileProvider');
  return value;
}
