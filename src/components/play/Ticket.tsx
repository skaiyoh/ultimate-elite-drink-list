import type { TicketLine } from '@/lib/session/types';
import './play.css';

export function Ticket({ lines }: { lines: readonly TicketLine[] }) {
  return (
    <ol className="ticket" aria-label="Round ticket">
      {lines.map((line) => (
        <li key={line.drinkId} className="ticket__line" aria-label={`${line.name}, ${line.quantity}`}>
          <span className="ticket__name">{line.name}</span>
          <span className="ticket__qty" aria-hidden="true">×{line.quantity}</span>
        </li>
      ))}
    </ol>
  );
}
