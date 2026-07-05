import { useEffect, useState } from 'react';
import './kitchen.css';
import { Button } from '@/components/primitives';
import { bumpTicket, loadOpenTickets, subscribeTickets } from '@/data/kitchenRepo';
import { cx } from '@/lib/cx';
import type { KitchenTicket } from '@/types/db';

const LATE_AFTER_MIN = 10;

/**
 * The Kitchen Display: a live wall of fired tickets, oldest first. New fires
 * arrive over Realtime; "Done" bumps a ticket off the wall for every device.
 */
export function KitchenScreen() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const refresh = () =>
      void loadOpenTickets().then((t) => {
        setTickets(t);
        setLoaded(true);
      });
    refresh();
    const unsubscribe = subscribeTickets(refresh);
    const ageTimer = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => {
      unsubscribe();
      clearInterval(ageTimer);
    };
  }, []);

  const bump = (id: string) => {
    setTickets((ts) => ts.filter((t) => t.id !== id));
    void bumpTicket(id);
  };

  return (
    <div className="kds">
      {loaded && tickets.length === 0 ? (
        <div className="kds__empty">All caught up — no open tickets.</div>
      ) : (
        <div className="kds__grid">
          {tickets.map((t) => (
            <Ticket key={t.id} ticket={t} onBump={() => bump(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Ticket({ ticket, onBump }: { ticket: KitchenTicket; onBump: () => void }) {
  const ageMin = Math.max(0, Math.floor((Date.now() - new Date(ticket.fired_at).getTime()) / 60_000));
  return (
    <article className={cx('ticket', ageMin >= LATE_AFTER_MIN && 'ticket--late')}>
      <div className="ticket__head">
        <span className="ticket__table">T{ticket.table_number}</span>
        <span className="ticket__meta">
          <span className="ticket__station">{ticket.station}</span>
          <span className="ticket__age">{ageMin}m</span>
        </span>
      </div>
      <div className="ticket__items">
        {ticket.items.map((item, i) => (
          <div key={i} className={cx('titem', item.kind === 'cancel' && 'titem--cancel')}>
            <span className="titem__qty">
              {item.kind === 'cancel' ? `−${item.qty}` : `${item.qty}×`}
            </span>
            <span className="titem__body">
              <div className="titem__name">{item.name}</div>
              {item.note && <div className="titem__note">“{item.note}”</div>}
              {item.kind === 'cancel' && <div className="titem__tag">Cancelled</div>}
              {item.kind === 'note' && <div className="titem__tag">Note update</div>}
            </span>
          </div>
        ))}
      </div>
      <Button variant="primary" className="ticket__bump" onClick={onBump}>
        Done
      </Button>
    </article>
  );
}
