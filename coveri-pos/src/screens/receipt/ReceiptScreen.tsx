import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import './receipt.css';
import { Button } from '@/components/primitives';
import { loadCatalog, type Catalog } from '@/data/catalogRepo';
import { loadOrderDocument, loadPaymentMethods } from '@/data/paymentRepo';
import { formatMoney } from '@/lib/money';
import { computeOrderTotals } from '@/lib/tax';
import type { PosOrder, PosOrderLine, PosPayment, PosPaymentMethod, UUID } from '@/types/db';

/**
 * Renders either the final RECEIPT (paid order) or the pro-forma BILL
 * (before payment) for an order. Same editorial document; print styles turn
 * it into clean black-on-white thermal paper.
 */
export function ReceiptScreen({ kind }: { kind: 'receipt' | 'bill' }) {
  const { orderId } = useParams<{ orderId: UUID }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState<{
    order: PosOrder;
    lines: PosOrderLine[];
    payments: PosPayment[];
  } | null>(null);
  const [methods, setMethods] = useState<PosPaymentMethod[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    Promise.all([loadOrderDocument(orderId), loadPaymentMethods(), loadCatalog()])
      .then(([d, m, c]) => {
        setDoc(d);
        setMethods(m);
        setCatalog(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [orderId]);

  const totals = useMemo(() => {
    if (!doc || !catalog) return null;
    return computeOrderTotals(
      doc.lines.map((l) => ({
        id: l.id,
        quantity: Number(l.qty),
        priceUnit: Number(l.price_unit),
        discount: Number(l.discount),
        taxes: (l.product_id && catalog.taxesByProduct.get(l.product_id)) || [],
      })),
    );
  }, [doc, catalog]);

  if (error) return <div className="pay-status">Couldn't load the document: {error}</div>;
  if (!doc || !totals) return <div className="pay-status">Preparing {kind}…</div>;

  const change = parseFloat(params.get('change') ?? '0') || 0;
  const methodName = (id: string | null) => methods.find((m) => m.id === id)?.name ?? 'Payment';
  const when = new Date();

  return (
    <div className="receipt-screen">
      <article className="rdoc">
        <div className="rdoc__brand">
          COV<em>E</em>RI
        </div>
        <div className="rdoc__tag">Service, Simplified.</div>
        <div className="rdoc__kind">{kind === 'bill' ? 'Bill — not a receipt' : 'Receipt'}</div>
        <div className="rdoc__meta">
          <span>
            {when.toLocaleDateString()} {when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span>{doc.order.customer_count} guests</span>
        </div>

        {doc.lines.map((l) => {
          const lt = totals.lines.find((x) => x.id === l.id);
          return (
            <div key={l.id} className="rdoc__line">
              <span className="rdoc__line-name">
                {Number(l.qty)}× {l.full_product_name}
                {Number(l.discount) > 0 && <span className="rdoc__line-note"> (−{Number(l.discount)}%)</span>}
                {l.note && <div className="rdoc__line-note">“{l.note}”</div>}
              </span>
              <span className="rdoc__line-amount">{formatMoney(lt?.priceTotal ?? 0)}</span>
            </div>
          );
        })}

        <div className="rdoc__totals">
          <div className="rdoc__row">
            <span>Subtotal</span>
            <span className="numeric">{formatMoney(totals.subtotal)}</span>
          </div>
          {totals.taxes.map((tx) => (
            <div className="rdoc__row" key={tx.taxId}>
              <span>{tx.name}</span>
              <span className="numeric">{formatMoney(tx.amount)}</span>
            </div>
          ))}
          <div className="rdoc__row rdoc__row--grand">
            <span>Total</span>
            <span className="numeric">{formatMoney(totals.total)}</span>
          </div>
          {kind === 'receipt' &&
            doc.payments.map((p) => (
              <div className="rdoc__row" key={p.id}>
                <span>{methodName(p.method_id)}</span>
                <span className="numeric">{formatMoney(Number(p.amount))}</span>
              </div>
            ))}
          {kind === 'receipt' && change > 0 && (
            <div className="rdoc__row rdoc__row--change">
              <span>Change</span>
              <span className="numeric">{formatMoney(change)}</span>
            </div>
          )}
        </div>

        <div className="rdoc__foot">
          {kind === 'bill' ? 'Please settle at your convenience.' : 'Thank you — see you soon.'}
        </div>
      </article>

      <div className="receipt-actions">
        <Button
          variant="ghost"
          onClick={() => (kind === 'bill' ? navigate(-1) : navigate('/'))}
        >
          {kind === 'bill' ? 'Back' : 'Floor'}
        </Button>
        <Button variant="primary" onClick={() => window.print()}>
          Print
        </Button>
      </div>
    </div>
  );
}
