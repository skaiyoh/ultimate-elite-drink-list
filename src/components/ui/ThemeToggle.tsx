'use client';
import { useEffect, useState } from 'react';
import { applyTheme } from '@/lib/browser/theme';
import { loadTheme, saveTheme, type ThemeChoice } from '@/lib/theme/repository';
import './ui.css';

const LABELS: Record<ThemeChoice, string> = { system: 'System', light: 'Light', dark: 'Dark' };
const ORDER: readonly ThemeChoice[] = ['system', 'light', 'dark'];

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>('system');

  useEffect(() => {
    // The inline script in the layout has already put the right theme on the
    // page before first paint; this only catches the control up to it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(loadTheme());
  }, []);

  const pick = (next: ThemeChoice) => {
    setChoice(next);
    applyTheme(next);
    // Losing this costs one tap next visit, so the outcome is not surfaced —
    // unlike a session write, nothing is destroyed if it fails.
    saveTheme(next);
  };

  return (
    <div className="theme" role="group" aria-label="Theme">
      {ORDER.map((option) => (
        <button
          key={option}
          type="button"
          className="theme__option"
          aria-pressed={choice === option}
          onClick={() => pick(option)}
        >
          {LABELS[option]}
        </button>
      ))}
    </div>
  );
}
