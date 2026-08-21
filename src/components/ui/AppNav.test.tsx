// src/components/ui/AppNav.test.tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppNav } from '@/components/ui/AppNav';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

describe('AppNav', () => {
  beforeEach(() => { pathname = '/'; });

  it('links to every top-level screen', () => {
    render(<AppNav />);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    for (const label of ['Profiles', 'Drill', 'History', 'Stats', 'Drinks']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('marks the screen you are on', () => {
    pathname = '/history';
    render(<AppNav />);
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Stats' })).not.toHaveAttribute('aria-current');
  });

  it('treats a session summary as part of History', () => {
    pathname = '/summary/abc';
    render(<AppNav />);
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page');
  });

  it('disappears during a round, where a stray tap would discard it', () => {
    pathname = '/play';
    const { container } = render(<AppNav />);
    expect(container).toBeEmptyDOMElement();
  });
});
