import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme } from '@/lib/browser/theme';

afterEach(() => { Reflect.deleteProperty(document.documentElement.dataset, 'theme'); });

describe('applyTheme', () => {
  it('pins the page to light', () => {
    applyTheme('light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('pins the page to dark', () => {
    applyTheme('dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('removes the override entirely when following the system', () => {
    // Not `data-theme="system"`: the tokens key off the attribute's absence to
    // let prefers-color-scheme decide, so leaving any value here pins the page.
    applyTheme('dark');
    applyTheme('system');
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });
});
