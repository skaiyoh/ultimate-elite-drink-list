const PREFIX = 'ueddl:v1';

export const STORAGE_KEYS = {
  drinks: `${PREFIX}:drinks`,
  theme: `${PREFIX}:theme`,
  prefs: `${PREFIX}:prefs`,
  activeSession: `${PREFIX}:active-session`,
  lastRun: `${PREFIX}:last-run`,
} as const;
