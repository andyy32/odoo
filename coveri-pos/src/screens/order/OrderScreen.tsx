import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './order.css';
import { Button, Numpad, OrderLineRow, SlidePanel } from '@/components/primitives';
import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/money';
import { computeLineTotals } from '@/lib/tax';
import { useFloorStore } from '@/stores/floorStore';
import { useOrderStore } from '@/stores/orderStore';
import type { PosOrderLine, UUID } from '@/types/db';

/**
 * The order screen: catalog on the left (or full-screen on phones with a
 * bottom order bar), the editorial order card on the right. Tapping a line
 * opens the slide-in editor (qty numpad, note, discount).
 */
export function OrderScreen() {
  const { tableId } = useParams<{ tableId: UUID }>();
  const navigate = useNavigate();

  const floorLoaded = useFloorStore((s) => s.tables.length > 0);
  const loadFloor = useFloorStore((s) => s.load);
  const table = useFloorStore((s) => s.tables.find((t) => t.id === tableId));

  const {
    loading,
    error,
    catalog,
    order,
    lines,
    editingLineId,
    openForTable,
    addProduct,
    setQty,
    setNote,
    setDiscount,
    removeLine,
    setGuests,
    setEditingLine,
    totals,
    pendingFireCount,
    fireOrder,
  } = useOrderStore();

  const [categoryId, setCategoryId] = useState<UUID | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [justFired, setJustFired] = useState(false);

  // Floor data may not be loaded on a direct URL hit.
  useEffect(() => {
    if (!floorLoaded) void loadFloor();
  }, [floorLoaded, loadFloor]);

  useEffect(() => {
    if (table) void openForTable(table.id, table.company_id, table.seats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.id]);

  const products = useMemo(() => {
    if (!catalog) return [];
    const q = search.trim().toLowerCase();
    return catalog.products.filter((p) => {
      if (q) return p.name.toLowerCase().includes(q);
      return categoryId === 'all' || p.category_id === categoryId;
    });
  }, [catalog, categoryId, search]);

  const t = totals();
  const editingLine = lines.find((l) => l.id === editingLineId) ?? null;

  if (!table && floorLoaded) {
    return (
      <div className="order-status">
        Unknown table. <Button variant="ghost" onClick={() => navigate('/')}>← Back to floor</Button>
      </div>
    );
  }
  if (loading || !catalog || !order) {
    return <div className="order-status">{error ? `Couldn't open the order: ${error}` : 'Opening order…'}</div>;
  }

  const lineTotal = (l: PosOrderLine) =>
    computeLineTotals({
      id: l.id,
      quantity: Number(l.qty),
      priceUnit: Number(l.price_unit),
      discount: Number(l.discount),
      taxes: (l.product_id && catalog.taxesByProduct.get(l.product_id)) || [],
    }).priceTotal;

  const orderCard = (
    <div className="order-card">
      <div className="order-card__head">
        <span className="order-card__title">Table {table?.table_number}</span>
        <button className="order-card__guests" onClick={() => setGuestsOpen(true)}>
          {order.customer_count} guests
        </button>
      </div>
      <div className="order-card__lines">
        {lines.length === 0 && <div className="order-card__empty">Tap a dish to start the order.</div>}
        {lines.map((l) => (
          <OrderLineRow
            key={l.id}
            name={l.full_product_name}
            qty={Number(l.qty)}
            price={lineTotal(l)}
            note={l.note}
            onClick={() => setEditingLine(l.id)}
          />
        ))}
      </div>
      <div className="order-card__foot">
        <div className="order-foot__row">
          <span>Subtotal</span>
          <span className="numeric">{formatMoney(t.subtotal)}</span>
        </div>
        {t.taxes.map((tax) => (
          <div className="order-foot__row" key={tax.taxId}>
            <span>{tax.name}</span>
            <span className="numeric">{formatMoney(tax.amount)}</span>
          </div>
        ))}
        <div className="order-foot__grand">
          <span>Total</span>
          <b className="numeric">{formatMoney(t.total)}</b>
        </div>
        <div className="order-foot__actions">
          <Button variant="ghost" onClick={() => navigate('/')}>
            Floor
          </Button>
          <Button variant="ghost" disabled={lines.length === 0} onClick={() => navigate(`/bill/${order.id}`)}>
            Bill
          </Button>
          <Button variant="ghost" disabled={lines.length === 0} onClick={() => navigate(`/table/${tableId}/pay`)}>
            Pay
          </Button>
          <Button
            variant="primary"
            disabled={pendingFireCount(table?.table_number ?? '') === 0 && !justFired}
            onClick={() => {
              void fireOrder(table?.table_number ?? '').then((n) => {
                if (n > 0) {
                  setJustFired(true);
                  setTimeout(() => setJustFired(false), 2000);
                }
              });
            }}
          >
            {justFired
              ? 'Fired ✓'
              : pendingFireCount(table?.table_number ?? '') > 0
                ? `Fire to Kitchen (${pendingFireCount(table?.table_number ?? '')})`
                : 'Fire to Kitchen'}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="order-screen">
      <section className="catalog">
        <input
          className="catalog__search"
          placeholder="Search the menu…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search products"
        />
        <div className="cat-rail" role="tablist" aria-label="Categories">
          <button
            role="tab"
            aria-selected={categoryId === 'all'}
            className={cx('cat-chip', categoryId === 'all' && 'cat-chip--on')}
            onClick={() => setCategoryId('all')}
          >
            All
          </button>
          {catalog.categories.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={categoryId === c.id}
              className={cx('cat-chip', categoryId === c.id && 'cat-chip--on')}
              onClick={() => {
                setCategoryId(c.id);
                setSearch('');
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="product-grid">
          {products.length === 0 && <div className="catalog__empty">Nothing matches “{search}”.</div>}
          {products.map((p) => (
            <button key={p.id} className="product-card" onClick={() => void addProduct(p)}>
              <span className="product-card__name">{p.name}</span>
              <span className="product-card__price numeric">{formatMoney(Number(p.price))}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Desktop / tablet: persistent order card */}
      <section className="order-card--desktop">{orderCard}</section>

      {/* Phone: bottom bar + slide-up sheet */}
      <button className="order-fab" onClick={() => setSheetOpen(true)}>
        <span>
          {lines.reduce((n, l) => n + Number(l.qty), 0)} items · Table {table?.table_number}
        </span>
        <span className="order-fab__total">{formatMoney(t.total)}</span>
      </button>
      <SlidePanel open={sheetOpen} onClose={() => setSheetOpen(false)} side="bottom" title="Order">
        {orderCard}
      </SlidePanel>

      {/* Line editor */}
      <SlidePanel
        open={editingLine !== null}
        onClose={() => setEditingLine(null)}
        side="right"
        title="Edit item"
        footer={
          editingLine && (
            <div className="line-editor__footer">
              <Button variant="danger" onClick={() => void removeLine(editingLine.id)}>
                Remove
              </Button>
              <Button variant="primary" onClick={() => setEditingLine(null)}>
                Done
              </Button>
            </div>
          )
        }
      >
        {editingLine && (
          <LineEditor
            line={editingLine}
            onQty={(q) => void setQty(editingLine.id, q)}
            onNote={(n) => void setNote(editingLine.id, n)}
            onDiscount={(d) => void setDiscount(editingLine.id, d)}
          />
        )}
      </SlidePanel>

      {/* Guest count */}
      <SlidePanel open={guestsOpen} onClose={() => setGuestsOpen(false)} side="right" title="Guest Count">
        <GuestEditor
          initial={order.customer_count}
          onDone={(n) => {
            void setGuests(n);
            setGuestsOpen(false);
          }}
        />
      </SlidePanel>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LineEditor({
  line,
  onQty,
  onNote,
  onDiscount,
}: {
  line: PosOrderLine;
  onQty: (qty: number) => void;
  onNote: (note: string) => void;
  onDiscount: (discount: number) => void;
}) {
  const qty = Number(line.qty);
  return (
    <>
      <div className="line-editor__name">{line.full_product_name}</div>
      <div className="line-editor__price numeric">{formatMoney(Number(line.price_unit))} each</div>

      <div className="line-editor__qty">
        <span className="stepper">
          <button className="stepper__btn" aria-label="Less" onClick={() => onQty(qty - 1)}>
            −
          </button>
          <span className="line-editor__qty-value">{qty}</span>
          <button className="stepper__btn" aria-label="More" onClick={() => onQty(qty + 1)}>
            +
          </button>
        </span>
      </div>

      <div className="line-editor__field">
        <label className="line-editor__label" htmlFor="line-note">
          Note to kitchen
        </label>
        <input
          id="line-note"
          className="line-editor__input"
          placeholder="e.g. no basil, sauce on the side"
          defaultValue={line.note ?? ''}
          onBlur={(e) => onNote(e.target.value)}
        />
      </div>

      <div className="line-editor__field">
        <span className="line-editor__label">Discount</span>
        <div className="discount-chips">
          {[0, 10, 20, 50].map((d) => (
            <button
              key={d}
              className={cx('discount-chip', Number(line.discount) === d && 'discount-chip--on')}
              onClick={() => onDiscount(d)}
            >
              {d === 0 ? 'None' : `${d}%`}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function GuestEditor({ initial, onDone }: { initial: number; onDone: (n: number) => void }) {
  const [entry, setEntry] = useState(String(initial));
  return (
    <>
      <div
        className="numeric"
        style={{ fontSize: 'var(--text-display)', fontWeight: 700, marginBottom: 'var(--space-5)' }}
      >
        {entry || '0'}
      </div>
      <Numpad
        onKey={(k) =>
          setEntry((prev) => {
            if (k === 'back') return prev.slice(0, -1);
            if (k === '.') return prev; // whole guests only
            return (prev === '0' ? '' : prev) + k;
          })
        }
        actionLabel="Set Guests"
        onAction={() => onDone(Math.max(1, parseInt(entry || '1', 10)))}
      />
    </>
  );
}
