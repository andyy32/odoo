import { cx } from '@/lib/cx';
import { formatMoney } from '@/lib/money';

export type TableStatus = 'free' | 'occupied' | 'needs-attention';

interface TableTileProps {
  number: string;
  seats: number;
  shape?: 'square' | 'round';
  status?: TableStatus;
  /** Running total when occupied. */
  total?: number;
  currencySymbol?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

/**
 * A single table on the floor plan — the centerpiece element. Status is shown
 * with an accent glow AND text (never color alone), and animates on change.
 */
export function TableTile({
  number,
  seats,
  shape = 'square',
  status = 'free',
  total,
  currencySymbol = '$',
  style,
  onClick,
}: TableTileProps) {
  return (
    <button
      className={cx(
        'table-tile',
        shape === 'round' && 'table-tile--round',
        status === 'occupied' && 'table-tile--occupied',
        status === 'needs-attention' && 'table-tile--needs-attention',
      )}
      style={style}
      onClick={onClick}
      aria-label={`Table ${number}, ${seats} seats, ${status}`}
    >
      <span className="table-tile__num">{number}</span>
      {status === 'free' ? (
        <span className="table-tile__meta">{seats} seats</span>
      ) : (
        <span className="table-tile__total numeric">
          {formatMoney(total ?? 0, { symbol: currencySymbol })}
        </span>
      )}
    </button>
  );
}
