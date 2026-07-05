import { cx } from '@/lib/cx';

interface NumpadProps {
  /** Called with the key pressed: '0'–'9', '.', or 'back'. */
  onKey: (key: string) => void;
  /** Label for the accent action key (e.g. 'Enter'); omit to hide it. */
  actionLabel?: string;
  onAction?: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

/** Touch numeric keypad — quantities, guest count, cash tendered. */
export function Numpad({ onKey, actionLabel, onAction }: NumpadProps) {
  return (
    <div className="numpad">
      {KEYS.map((k) => (
        <button
          key={k}
          className="numpad__key"
          onClick={() => onKey(k)}
          aria-label={k === 'back' ? 'Backspace' : k}
        >
          {k === 'back' ? '⌫' : k}
        </button>
      ))}
      {actionLabel && (
        <button className={cx('numpad__key', 'numpad__key--accent')} style={{ gridColumn: '1 / -1' }} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
