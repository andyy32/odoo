/*
 * COVERI POS — kitchen preparation delta engine.
 *
 * Each order carries a `prep_snapshot`: the exact state of its lines the last
 * time something was fired to the kitchen. Firing diffs the current lines
 * against that snapshot and produces per-station tickets containing ONLY what
 * changed — new items, cancelled quantities, and note updates — so the
 * kitchen never re-reads the whole order. After firing, the snapshot is
 * replaced with the current state.
 *
 * Pure functions, no I/O — unit-tested in prep.test.ts.
 */

export interface PrepSnapshotLine {
  lineId: string;
  name: string;
  qty: number;
  note: string | null;
  station: string;
}

export interface FireableLine {
  id: string;
  name: string;
  qty: number;
  note: string | null;
  /** Prep station from the product (e.g. 'kitchen', 'bar'); null = never fired. */
  station: string | null;
}

export type TicketItemKind = 'add' | 'cancel' | 'note';

export interface TicketItem {
  kind: TicketItemKind;
  name: string;
  /** For add/cancel: the quantity delta. For note: the current qty. */
  qty: number;
  note: string | null;
}

export interface StationTicket {
  station: string;
  items: TicketItem[];
}

/**
 * Diff current lines against the last-fired snapshot.
 * Returns one ticket per station that has changes (empty array = nothing new).
 */
export function computePrepDelta(
  lines: FireableLine[],
  snapshot: PrepSnapshotLine[],
): StationTicket[] {
  const snapById = new Map(snapshot.map((s) => [s.lineId, s]));
  const byStation = new Map<string, TicketItem[]>();

  const push = (station: string, item: TicketItem) => {
    const list = byStation.get(station) ?? [];
    list.push(item);
    byStation.set(station, list);
  };

  for (const line of lines) {
    if (!line.station) continue; // product isn't routed to any prep station
    const snap = snapById.get(line.id);
    snapById.delete(line.id);

    if (!snap) {
      push(line.station, { kind: 'add', name: line.name, qty: line.qty, note: line.note });
      continue;
    }
    if (line.qty > snap.qty) {
      push(line.station, { kind: 'add', name: line.name, qty: line.qty - snap.qty, note: line.note });
    } else if (line.qty < snap.qty) {
      push(line.station, { kind: 'cancel', name: line.name, qty: snap.qty - line.qty, note: line.note });
    }
    if ((line.note ?? null) !== (snap.note ?? null)) {
      push(line.station, { kind: 'note', name: line.name, qty: line.qty, note: line.note });
    }
  }

  // Anything left in the snapshot was removed from the order entirely.
  for (const snap of snapById.values()) {
    push(snap.station, { kind: 'cancel', name: snap.name, qty: snap.qty, note: snap.note });
  }

  return [...byStation.entries()].map(([station, items]) => ({ station, items }));
}

/** The snapshot to store after a successful fire: the current fireable state. */
export function nextSnapshot(lines: FireableLine[]): PrepSnapshotLine[] {
  return lines
    .filter((l): l is FireableLine & { station: string } => l.station !== null)
    .map((l) => ({ lineId: l.id, name: l.name, qty: l.qty, note: l.note ?? null, station: l.station }));
}
