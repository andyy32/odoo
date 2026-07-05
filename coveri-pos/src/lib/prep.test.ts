import { describe, expect, it } from 'vitest';
import { computePrepDelta, nextSnapshot, type FireableLine } from './prep';

const line = (
  id: string,
  name: string,
  qty: number,
  station: string | null = 'kitchen',
  note: string | null = null,
): FireableLine => ({ id, name, qty, note, station });

describe('computePrepDelta', () => {
  it('first fire sends everything, grouped by station', () => {
    const lines = [line('a', 'Ribeye', 2), line('b', 'Négroni', 1, 'bar')];
    const tickets = computePrepDelta(lines, []);
    expect(tickets).toHaveLength(2);
    const kitchen = tickets.find((t) => t.station === 'kitchen')!;
    expect(kitchen.items).toEqual([{ kind: 'add', name: 'Ribeye', qty: 2, note: null }]);
    const bar = tickets.find((t) => t.station === 'bar')!;
    expect(bar.items).toEqual([{ kind: 'add', name: 'Négroni', qty: 1, note: null }]);
  });

  it('refire with no changes produces no tickets', () => {
    const lines = [line('a', 'Ribeye', 2)];
    const snap = nextSnapshot(lines);
    expect(computePrepDelta(lines, snap)).toEqual([]);
  });

  it('only the quantity increase is sent on refire', () => {
    const snap = nextSnapshot([line('a', 'Ribeye', 2)]);
    const tickets = computePrepDelta([line('a', 'Ribeye', 5)], snap);
    expect(tickets).toEqual([
      { station: 'kitchen', items: [{ kind: 'add', name: 'Ribeye', qty: 3, note: null }] },
    ]);
  });

  it('quantity decrease fires a cancel for the difference', () => {
    const snap = nextSnapshot([line('a', 'Ribeye', 3)]);
    const tickets = computePrepDelta([line('a', 'Ribeye', 1)], snap);
    expect(tickets[0].items).toEqual([{ kind: 'cancel', name: 'Ribeye', qty: 2, note: null }]);
  });

  it('removing a line entirely cancels the full fired quantity', () => {
    const snap = nextSnapshot([line('a', 'Ribeye', 2), line('b', 'Cod', 1)]);
    const tickets = computePrepDelta([line('a', 'Ribeye', 2)], snap);
    expect(tickets[0].items).toEqual([{ kind: 'cancel', name: 'Cod', qty: 1, note: null }]);
  });

  it('note change fires a note update', () => {
    const snap = nextSnapshot([line('a', 'Tartare', 1, 'kitchen', null)]);
    const tickets = computePrepDelta([line('a', 'Tartare', 1, 'kitchen', 'no capers')], snap);
    expect(tickets[0].items).toEqual([{ kind: 'note', name: 'Tartare', qty: 1, note: 'no capers' }]);
  });

  it('qty change and note change on the same line produce both items', () => {
    const snap = nextSnapshot([line('a', 'Tartare', 1)]);
    const tickets = computePrepDelta([line('a', 'Tartare', 2, 'kitchen', 'rare')], snap);
    expect(tickets[0].items).toEqual([
      { kind: 'add', name: 'Tartare', qty: 1, note: 'rare' },
      { kind: 'note', name: 'Tartare', qty: 2, note: 'rare' },
    ]);
  });

  it('lines without a station never fire and never linger in the snapshot', () => {
    const lines = [line('a', 'Open item', 1, null)];
    expect(computePrepDelta(lines, [])).toEqual([]);
    expect(nextSnapshot(lines)).toEqual([]);
  });
});
