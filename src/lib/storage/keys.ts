const PREFIX = 'ueddl:v1';

export const STORAGE_KEYS = {
  drinks: `${PREFIX}:drinks`,
  profiles: `${PREFIX}:profiles`,
  activeProfile: `${PREFIX}:active-profile`,
  theme: `${PREFIX}:theme`,
  activeSession: `${PREFIX}:active-session`,
  lastRun: `${PREFIX}:last-run`,
  prefs: (profileId: string) => `${PREFIX}:profile:${profileId}:prefs`,
} as const;
