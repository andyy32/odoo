import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cx } from '@/lib/cx';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  /** Right drawer (desktop/tablet) or bottom sheet (phone-friendly). */
  side?: 'right' | 'bottom';
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * COVERI's signature "no disruptive popups" pattern: content slides in from the
 * edge over a scrim. Used for modifiers, guest count, payment, etc.
 */
export function SlidePanel({ open, onClose, side = 'right', title, children, footer }: SlidePanelProps) {
  const initial = side === 'right' ? { x: '100%' } : { y: '100%' };
  const animate = side === 'right' ? { x: 0 } : { y: 0 };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="panel__scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className={cx('panel', `panel--${side}`)}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={initial}
            animate={animate}
            exit={initial}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
          >
            {side === 'bottom' && <div className="panel__grabber" />}
            {title && (
              <div className="panel__header">
                <span className="panel__title">{title}</span>
                <button className="btn btn--ghost" onClick={onClose} aria-label="Close">
                  ✕
                </button>
              </div>
            )}
            <div className="panel__body">{children}</div>
            {footer}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
