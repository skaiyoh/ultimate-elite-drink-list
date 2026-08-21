// src/components/ui/ThemeToggle.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { loadTheme } from '@/lib/theme/repository';

afterEach(() => { Reflect.deleteProperty(document.documentElement.dataset, 'theme'); });

describe('ThemeToggle', () => {
  it('offers system, light and dark', () => {
    render(<ThemeToggle />);
    for (const label of ['System', 'Light', 'Dark']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('starts on system, the state before anyone chooses', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('applies a chosen theme to the page immediately', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  it('remembers the choice for next time', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(loadTheme()).toBe('light');
  });

  it('moves the pressed state to the chosen option', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));

    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('hands the page back to the system', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));
    await userEvent.click(screen.getByRole('button', { name: 'System' }));

    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('opens on the stored choice rather than resetting it', async () => {
    const first = render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));
    first.unmount();

    render(<ThemeToggle />);
    expect(await screen.findByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('names itself, so the buttons are not three loose words in the nav', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
  });
});
