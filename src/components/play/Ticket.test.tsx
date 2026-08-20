// src/components/play/Ticket.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Ticket } from '@/components/play/Ticket';
import type { TicketLine } from '@/lib/session/types';

const lines: TicketLine[] = [
  { drinkId: 'a', name: 'Green Tea Shot', categoryId: 'shot', quantity: 4 },
  { drinkId: 'b', name: 'Espresso Martini', categoryId: 'martini', quantity: 1 },
];

describe('Ticket', () => {
  it('lists exactly the dealt drinks', () => {
    render(<Ticket lines={lines} />);
    expect(screen.getByRole('list', { name: 'Round ticket' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows each drink with its quantity', () => {
    render(<Ticket lines={lines} />);
    expect(screen.getByText('Green Tea Shot')).toBeInTheDocument();
    expect(screen.getByText('×4')).toBeInTheDocument();
    expect(screen.getByText('×1')).toBeInTheDocument();
  });

  it('announces quantities to screen readers without relying on the × glyph', () => {
    render(<Ticket lines={lines} />);
    expect(screen.getByLabelText('Green Tea Shot, 4')).toBeInTheDocument();
  });
});
