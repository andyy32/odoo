/*
 * COVERI POS — tax & order-total engine.
 *
 * This is the single source of truth for every number the customer and the
 * books see. It is a pure, framework-free module so it can be unit-tested
 * exhaustively (see tax.test.ts).
 *
 * Design (a clean-room reimplementation of the behavior Odoo's account_tax
 * implements, NOT a copy):
 *  - A line has a quantity, a unit price, an optional percentage discount, and
 *    a set of percentage taxes.
 *  - Taxes are either price-EXCLUDED (added on top) or price-INCLUDED (already
 *    baked into the unit price). A line's taxes must all share the same
 *    inclusion mode in V1 (the common restaurant case).
 *  - Multiple taxes on one line are treated as additive percentages
 *    (e.g. 10% + 5% = 15% of the net base), which matches the vast majority of
 *    hospitality tax setups. Compound taxes are a Phase-3 concern.
 *  - Rounding happens per line (round-per-line), then sums, which keeps results
 *    deterministic and easy to reconcile on a printed bill.
 */

import { roundTo } from './money';

export interface Tax {
  id: string;
  name: string;
  /** Percentage amount, e.g. 10 means 10%. */
  amount: number;
  /** If true, `price_unit` already includes this tax. */
  priceInclude: boolean;
}

export interface OrderLineInput {
  id: string;
  quantity: number;
  /** Unit price. Tax-inclusive iff the line's taxes are priceInclude. */
  priceUnit: number;
  /** Percentage discount 0–100. */
  discount?: number;
  taxes?: Tax[];
}

export interface LineTotals {
  id: string;
  quantity: number;
  /** Net base (after discount), tax excluded. */
  priceSubtotal: number;
  /** Net base + taxes. */
  priceTotal: number;
  /** Tax portion for this line. */
  taxAmount: number;
}

export interface TaxBreakdown {
  taxId: string;
  name: string;
  base: number;
  amount: number;
}

export interface OrderTotals {
  lines: LineTotals[];
  /** Sum of line subtotals (tax excluded). */
  subtotal: number;
  /** Total tax across all lines. */
  taxTotal: number;
  /** Grand total (subtotal + tax). */
  total: number;
  /** Per-tax breakdown, grouped by tax id (for the bill/receipt footer). */
  taxes: TaxBreakdown[];
}

const DECIMALS = 2;

/** Compute totals for a single line. Exported for reuse in the order screen. */
export function computeLineTotals(line: OrderLineInput): LineTotals {
  const discount = clampDiscount(line.discount ?? 0);
  const gross = line.quantity * line.priceUnit * (1 - discount / 100);
  const taxes = line.taxes ?? [];

  if (taxes.length === 0) {
    const subtotal = roundTo(gross, DECIMALS);
    return { id: line.id, quantity: line.quantity, priceSubtotal: subtotal, priceTotal: subtotal, taxAmount: 0 };
  }

  const included = taxes.every((t) => t.priceInclude);
  const excluded = taxes.every((t) => !t.priceInclude);
  if (!included && !excluded) {
    throw new Error(
      `Line ${line.id}: mixing price-included and price-excluded taxes on one line is not supported.`,
    );
  }

  const rateSum = taxes.reduce((s, t) => s + t.amount, 0) / 100;

  let base: number;
  let taxAmount: number;
  if (included) {
    // `gross` already contains the taxes; back them out additively.
    base = gross / (1 + rateSum);
    taxAmount = gross - base;
  } else {
    base = gross;
    taxAmount = gross * rateSum;
  }

  const priceSubtotal = roundTo(base, DECIMALS);
  const roundedTax = roundTo(taxAmount, DECIMALS);
  return {
    id: line.id,
    quantity: line.quantity,
    priceSubtotal,
    priceTotal: roundTo(priceSubtotal + roundedTax, DECIMALS),
    taxAmount: roundedTax,
  };
}

/** Compute full order totals + per-tax breakdown from raw lines. */
export function computeOrderTotals(lines: OrderLineInput[]): OrderTotals {
  const lineTotals: LineTotals[] = [];
  const taxMap = new Map<string, TaxBreakdown>();

  for (const line of lines) {
    const lt = computeLineTotals(line);
    lineTotals.push(lt);

    const taxes = line.taxes ?? [];
    if (taxes.length === 0) continue;

    // Distribute this line's rounded tax across its taxes by rate share, so the
    // per-tax breakdown always sums back to the line's tax to the cent.
    const rateSum = taxes.reduce((s, t) => s + t.amount, 0);
    let distributed = 0;
    taxes.forEach((t, i) => {
      const isLast = i === taxes.length - 1;
      const share = isLast
        ? lt.taxAmount - distributed
        : roundTo(rateSum === 0 ? 0 : (lt.taxAmount * t.amount) / rateSum, DECIMALS);
      distributed += share;

      const existing = taxMap.get(t.id);
      if (existing) {
        existing.base = roundTo(existing.base + lt.priceSubtotal, DECIMALS);
        existing.amount = roundTo(existing.amount + share, DECIMALS);
      } else {
        taxMap.set(t.id, { taxId: t.id, name: t.name, base: lt.priceSubtotal, amount: share });
      }
    });
  }

  const subtotal = roundTo(
    lineTotals.reduce((s, l) => s + l.priceSubtotal, 0),
    DECIMALS,
  );
  const taxTotal = roundTo(
    lineTotals.reduce((s, l) => s + l.taxAmount, 0),
    DECIMALS,
  );

  return {
    lines: lineTotals,
    subtotal,
    taxTotal,
    total: roundTo(subtotal + taxTotal, DECIMALS),
    taxes: [...taxMap.values()],
  };
}

function clampDiscount(d: number): number {
  if (!Number.isFinite(d)) return 0;
  return Math.min(100, Math.max(0, d));
}
