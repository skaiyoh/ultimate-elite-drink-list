import type { ThemeChoice } from '@/lib/theme/repository';

/**
 * Writes the choice onto the root element, where tokens.css reads it.
 *
 * `system` removes the attribute rather than setting `data-theme="system"`:
 * the dark block is guarded on `:root:not([data-theme='light'])`, so any value
 * left here would pin the page instead of handing it back to the OS.
 */
export function applyTheme(choice: ThemeChoice): void {
  if (choice === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
}
