import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';

type Variant = 'default' | 'primary' | 'ghost' | 'danger' | 'success';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'lg';
  block?: boolean;
  children: ReactNode;
}

/** COVERI primary control. Flat, rounded, touch-sized; accent used sparingly. */
export function Button({
  variant = 'default',
  size = 'md',
  block = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx(
        'btn',
        variant !== 'default' && `btn--${variant}`,
        size === 'lg' && 'btn--lg',
        block && 'btn--block',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
