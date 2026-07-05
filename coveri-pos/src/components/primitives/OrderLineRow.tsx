import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/money';

interface OrderLineRowProps {
  name: string;
  qty: number;
  /** Extended line price (already computed). */
  price: number;
  note?: string | null;
  /** Highlights the row as an unsent change (fed by the kitchen-delta engine). */
  changed?: boolean;
  currencySymbol?: string;
  onClick?: () => void;
}

/** An editorial-style order line: bold qty chip, product name, tabular price. */
export function OrderLineRow({
  name,
  qty,
  price,
  note,
  changed = false,
  currencySymbol = '$',
  onClick,
}: OrderLineRowProps) {
  return (
    <div className={cx('oline', changed && 'oline--changed')} onClick={onClick} role={onClick ? 'button' : undefined}>
      <span className="oline__qty numeric">{qty}</span>
      <div>
        <div className="oline__name">{name}</div>
        {note && <div className="oline__note">{note}</div>}
      </div>
      <span className="oline__price numeric">{formatMoney(price, { symbol: currencySymbol })}</span>
    </div>
  );
}
