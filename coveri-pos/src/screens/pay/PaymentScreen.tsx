import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './pay.css';
import { Button, Numpad } from '@/components/primitives';
import { cacheOrderDocument, insertPayments, loadPaymentMethods } from '@/data/paymentRepo';
import { cacheDraftOrder, updateOrder } from '@/data/orderRepo';
import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/money';
import { useFloorStore } from '@/stores/floorStore';
import { useOrderStore } from '@/stores/orderStore';
import { useSessionStore } from '@/stores/sessionStore';
import type { PosPayment, PosPaymentMethod, UUID } from '@/types/db';

interface PayLine {
  id: UUID;
  method: PosPaymentMethod;
  amount: number;
}

/**
 * Payment: pick a method, enter the tendered amount (numpad or quick-cash),
 * stack payment lines until the order is covered, validate. Cash overpayment
 * becomes change due. Validation marks the order paid — which frees the table.
 */
export function PaymentScreen() {
  const { tableId } = useParams<{ tableId: UUID }>();
  const navigate = useNavigate();

  const floorLoaded = useFloorStore((s) => s.tables.length > 0);
  const loadFloor = useFloorStore((s) => s.load);
  const table = useFloorStore((s) => s.tables.find((t) => t.id === tableId));
  const { order, lines, loading, openForTable, totals, reset } = useOrderStore();
  const session = useSessionStore((s) => s.session);
  const sessionLoading = useSessionStore((s) => s.loading);

  const [methods, setMethods] = useState<PosPaymentMethod[]>([]);
  const [selected, setSelected] = useState<PosPaymentMethod | null>(null);
  const [entry, setEntry] = useState('');
  const [payLines, setPayLines] = useState<PayLine[]>([]);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (!floorLoaded) void loadFloor();
  }, [floorLoaded, loadFloor]);

  useEffect(() => {
    if (table) void openForTable(table.id, table.company_id, table.seats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table?.id]);

  useEffect(() => {
    void loadPaymentMethods().then((m) => {
      setMethods(m);
      setSelected(m[0] ?? null);
    });
  }, []);

  const t = totals();
  const paid = payLines.reduce((s, l) => s + l.amount, 0);
  const remaining = Math.max(0, +(t.total - paid).toFixed(2));
  const change = Math.max(0, +(paid - t.total).toFixed(2));
  const covered = paid >= t.total && t.total > 0;

  const entryAmount = useMemo(() => {
    const n = parseFloat(entry);
    return Number.isFinite(n) ? +n.toFixed(2) : 0;
  }, [entry]);

  // Quick-cash: exact remaining, then rounded-up notes.
  const quickAmounts = useMemo(() => {
    if (remaining <= 0) return [];
    const ups = [5, 10, 20, 50].map((n) => Math.ceil(remaining / n) * n);
    return [remaining, ...ups].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
  }, [remaining]);

  const addPayLine = (amount: number) => {
    if (!selected || amount <= 0) return;
    // Non-cash methods can't be tendered above what's still due.
    const capped = selected.is_cash ? amount : Math.min(amount, remaining);
    if (capped <= 0) return;
    setPayLines((ls) => [...ls, { id: crypto.randomUUID(), method: selected, amount: capped }]);
    setEntry('');
  };

  const validate = async () => {
    if (!order || !covered || validating) return;
    setValidating(true);
    try {
      // Change comes back out of the cash tendered: record net amounts that sum
      // to the order total so the books balance.
      let changeLeft = change;
      const rows: PosPayment[] = payLines.map((l) => {
        let amount = l.amount;
        if (l.method.is_cash && changeLeft > 0) {
          const back = Math.min(amount, changeLeft);
          amount = +(amount - back).toFixed(2);
          changeLeft = +(changeLeft - back).toFixed(2);
        }
        return { id: l.id, order_id: order.id, method_id: l.method.id, amount };
      });
      const finalRows = rows.filter((r) => r.amount > 0);
      await insertPayments(finalRows);
      await updateOrder(order.id, { state: 'paid', session_id: session?.id ?? null });
      // Local copies so the receipt renders and the table reads free even if
      // this payment happened offline (rows still in the sync queue).
      cacheOrderDocument({
        order: { ...order, state: 'paid', session_id: session?.id ?? null },
        lines,
        payments: finalRows,
      });
      if (order.table_id) cacheDraftOrder(order.table_id, null);
      const orderId = order.id;
      reset();
      void loadFloor(); // frees the table on the floor plan
      navigate(`/receipt/${orderId}?change=${change.toFixed(2)}`, { replace: true });
    } finally {
      setValidating(false);
    }
  };

  if (!table && floorLoaded) {
    return (
      <div className="pay-status">
        Unknown table. <Button variant="ghost" onClick={() => navigate('/')}>← Floor</Button>
      </div>
    );
  }
  if (loading || !order || sessionLoading) return <div className="pay-status">Loading payment…</div>;
  if (!session) {
    return (
      <div className="pay-status">
        The register is closed — open it before taking payments.
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }}>
          <Button variant="ghost" onClick={() => navigate(`/table/${tableId}`)}>
            Back
          </Button>
          <Button variant="primary" onClick={() => navigate('/register')}>
            Open Register
          </Button>
        </div>
      </div>
    );
  }
  if (lines.length === 0) {
    return (
      <div className="pay-status">
        Nothing to pay on Table {table?.table_number}.
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Button variant="ghost" onClick={() => navigate(`/table/${tableId}`)}>
            ← Back to order
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="pay">
      {/* Left: method + amount entry */}
      <section className="pay__panel">
        <div className="pay__due">
          <span className="pay__due-label">
            Table {table?.table_number} · {lines.length} items
          </span>
          <span className="pay__due-amount">{formatMoney(remaining)}</span>
        </div>

        <div className="pay__methods">
          {methods.map((m) => (
            <button
              key={m.id}
              className={cx('pay-method', selected?.id === m.id && 'pay-method--on')}
              onClick={() => setSelected(m)}
            >
              {m.name}
            </button>
          ))}
        </div>

        <div className="pay__entry numeric" aria-label="Amount tendered">
          {entry || formatMoney(remaining)}
        </div>

        {selected?.is_cash && quickAmounts.length > 0 && (
          <div className="pay__quick">
            {quickAmounts.map((a) => (
              <button key={a} className="quick-chip" onClick={() => addPayLine(a)}>
                {formatMoney(a)}
              </button>
            ))}
          </div>
        )}

        <Numpad
          onKey={(k) =>
            setEntry((prev) => {
              if (k === 'back') return prev.slice(0, -1);
              if (k === '.') return prev.includes('.') ? prev : (prev || '0') + '.';
              return prev + k;
            })
          }
          actionLabel={`Add ${selected?.name ?? ''}`}
          onAction={() => addPayLine(entry ? entryAmount : remaining)}
        />
      </section>

      {/* Right: payment lines + validate */}
      <section className="pay__panel">
        <div className="pay__lines">
          {payLines.length === 0 && (
            <div style={{ color: 'var(--text-tertiary)', padding: 'var(--space-4) 0' }}>
              No payments yet — add cash or card on the left.
            </div>
          )}
          {payLines.map((l) => (
            <div key={l.id} className="pay-line">
              <span className="pay-line__method">{l.method.name}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <span className="pay-line__amount numeric">{formatMoney(l.amount)}</span>
                <button
                  className="pay-line__remove"
                  aria-label={`Remove ${l.method.name} payment`}
                  onClick={() => setPayLines((ls) => ls.filter((x) => x.id !== l.id))}
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>

        <div className="pay__summary">
          <div className="pay__row pay__row--due">
            <span>Total due</span>
            <b className="numeric">{formatMoney(t.total)}</b>
          </div>
          <div className="pay__row">
            <span>Paid</span>
            <span className="numeric">{formatMoney(paid)}</span>
          </div>
          {remaining > 0 && (
            <div className="pay__row">
              <span>Remaining</span>
              <span className="numeric">{formatMoney(remaining)}</span>
            </div>
          )}
          {change > 0 && (
            <div className="pay__row pay__row--change">
              <span>Change due</span>
              <span className="numeric">{formatMoney(change)}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 'var(--space-2)' }}>
          <Button variant="ghost" onClick={() => navigate(`/table/${tableId}`)}>
            Back
          </Button>
          <Button variant="primary" disabled={!covered || validating} onClick={() => void validate()}>
            {validating ? 'Validating…' : 'Validate Payment'}
          </Button>
        </div>
      </section>
    </div>
  );
}
