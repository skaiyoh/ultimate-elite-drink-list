const PREFIX = 'ueddl:v1';

export const STORAGE_KEYS = {
  drinks: `${PREFIX}:drinks`,
  profiles: `${PREFIX}:profiles`,
  activeProfile: `${PREFIX}:active-profile`,
  activeSession: `${PREFIX}:active-session`,
  prefs: (profileId: string) => `${PREFIX}:profile:${profileId}:prefs`,
  sessionIndex: (profileId: string) => `${PREFIX}:profile:${profileId}:session-index`,
  session: (sessionId: string) => `${PREFIX}:session:${sessionId}`,
} as const;
