import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '@/lib/cx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  flush?: boolean;
  children: ReactNode;
}

/** Charcoal surface with signature roundness. The base container of the UI. */
export function Card({ interactive, flush, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cx('card', interactive && 'card--interactive', flush && 'card--flush', className)}
      {...rest}
    >
      {children}
    </div>
  );
}
