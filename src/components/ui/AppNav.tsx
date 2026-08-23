'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './ui.css';

interface NavItem {
  readonly href: string;
  readonly label: string;
}

const ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Drill' },
  { href: '/results', label: 'Last run' },
  { href: '/drinks', label: 'Drinks' },
];

function isCurrent(item: NavItem, pathname: string): boolean {
  if (item.href === '/') return pathname === '/';
  return pathname.startsWith(item.href);
}

export function AppNav() {
  const pathname = usePathname();

  // Absent during a round on purpose. Leaving /play mid-round discards it:
  // the time that passed off-screen is unknowable, so the session resumes at
  // rest. A nav bar one stray tap away from that is a trap, not a convenience.
  if (pathname === '/play') return null;

  return (
    <nav className="nav" aria-label="Main navigation">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="nav__link"
          aria-current={isCurrent(item, pathname) ? 'page' : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
