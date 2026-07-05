import { useMemo, useState } from 'react';
import './App.css';
import {
  Button,
  Card,
  Numpad,
  OrderLineRow,
  SlidePanel,
  TableTile,
  type TableStatus,
} from './components/primitives';
import { computeOrderTotals, type OrderLineInput, type Tax } from './lib/tax';
import { formatMoney } from './lib/money';

/*
 * Phase 1 deliverable: a living style guide / COVERI shell. It renders the real
 * design tokens and primitives (nothing mocked in CSS) plus a real order total
 * computed by the tested tax engine — so what you see is what the app is built
 * from. Phases 2–6 replace this showcase with the actual floor/order screens.
 */

const TAX_10: Tax = { id: 'vat', name: 'VAT 10%', amount: 10, priceInclude: false };

const DEMO_LINES: (OrderLineInput & { name: string; note?: string; changed?: boolean })[] = [
  { id: '1', name: 'Wagyu Tartare', quantity: 1, priceUnit: 24, taxes: [TAX_10] },
  { id: '2', name: 'Burrata & Heirloom', quantity: 2, priceUnit: 18, taxes: [TAX_10], note: 'No basil' },
  { id: '3', name: 'Négroni', quantity: 2, priceUnit: 16, taxes: [TAX_10], changed: true },
];

const TABLES: { number: string; seats: number; shape: 'square' | 'round'; status: TableStatus; total?: number }[] = [
  { number: '1', seats: 2, shape: 'square', status: 'free' },
  { number: '2', seats: 4, shape: 'square', status: 'occupied', total: 128.4 },
  { number: '3', seats: 4, shape: 'round', status: 'needs-attention', total: 62 },
  { number: '4', seats: 6, shape: 'square', status: 'free' },
  { number: '5', seats: 2, shape: 'round', status: 'occupied', total: 41.8 },
  { number: '6', seats: 8, shape: 'square', status: 'free' },
];

const SWATCHES = [
  ['--bg', 'BG'],
  ['--surface', 'Surface'],
  ['--accent', 'Accent'],
  ['--success', 'OK'],
  ['--warning', 'Warn'],
  ['--error', 'Error'],
];

export function App() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [entry, setEntry] = useState('2');

  const totals = useMemo(() => computeOrderTotals(DEMO_LINES), []);

  const onKey = (k: string) => {
    setEntry((prev) => {
      if (k === 'back') return prev.slice(0, -1) || '0';
      if (k === '.' && prev.includes('.')) return prev;
      return (prev === '0' && k !== '.' ? '' : prev) + k;
    });
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">
            COV<em>E</em>RI
          </span>
          <span className="brand__tag">Service, Simplified.</span>
        </div>
        <div className="topbar__session">
          <span className="dot" /> Register open · Dinner
        </div>
      </header>

      <div className="layout">
        {/* Floor plan */}
        <section>
          <div className="section__label">Floor · Main Room</div>
          <div className="floor">
            {TABLES.map((t) => (
              <TableTile
                key={t.number}
                number={t.number}
                seats={t.seats}
                shape={t.shape}
                status={t.status}
                total={t.total}
              />
            ))}
          </div>

          <div className="section__label" style={{ marginTop: 'var(--space-6)' }}>
            Design tokens
          </div>
          <Card>
            <div className="swatches">
              {SWATCHES.map(([varName, label]) => (
                <div
                  key={varName}
                  className="swatch"
                  style={{ background: `var(${varName})`, boxShadow: '0 0 0 1px var(--divider) inset' }}
                >
                  {label}
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Order card */}
        <section>
          <div className="section__label">Table 2 · Order</div>
          <Card>
            <div className="order__head">
              <span className="order__title">Table 2</span>
              <span className="order__guests">4 guests</span>
            </div>

            {totals.lines.map((lt, i) => (
              <OrderLineRow
                key={lt.id}
                name={DEMO_LINES[i].name}
                qty={lt.quantity}
                price={lt.priceTotal}
                note={DEMO_LINES[i].note}
                changed={DEMO_LINES[i].changed}
              />
            ))}

            <div className="totals">
              <div className="totals__row">
                <span>Subtotal</span>
                <span className="numeric">{formatMoney(totals.subtotal)}</span>
              </div>
              {totals.taxes.map((t) => (
                <div className="totals__row" key={t.taxId}>
                  <span>{t.name}</span>
                  <span className="numeric">{formatMoney(t.amount)}</span>
                </div>
              ))}
              <div className="totals__grand">
                <span>Total</span>
                <b className="numeric">{formatMoney(totals.total)}</b>
              </div>
            </div>

            <div className="order__actions">
              <Button variant="ghost" onClick={() => setPanelOpen(true)}>
                Guests
              </Button>
              <Button variant="primary">Fire to Kitchen</Button>
            </div>
          </Card>
        </section>
      </div>

      {/* Signature slide panel (guest count) */}
      <SlidePanel open={panelOpen} onClose={() => setPanelOpen(false)} side="right" title="Guest Count">
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          How many guests at this table?
        </p>
        <div
          className="numeric"
          style={{ fontSize: 'var(--text-display)', fontWeight: 700, marginBottom: 'var(--space-5)' }}
        >
          {entry}
        </div>
        <Numpad onKey={onKey} actionLabel="Set Guests" onAction={() => setPanelOpen(false)} />
      </SlidePanel>
    </div>
  );
}
