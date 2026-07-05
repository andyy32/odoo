import { describe, it, expect } from 'vitest';
import { computeLineTotals, computeOrderTotals, type Tax } from './tax';

const excl10: Tax = { id: 't10', name: 'VAT 10%', amount: 10, priceInclude: false };
const excl5: Tax = { id: 't5', name: 'City 5%', amount: 5, priceInclude: false };
const incl10: Tax = { id: 'i10', name: 'VAT 10% (incl)', amount: 10, priceInclude: true };

describe('computeLineTotals', () => {
  it('no tax → subtotal equals total', () => {
    const r = computeLineTotals({ id: 'l', quantity: 3, priceUnit: 4 });
    expect(r.priceSubtotal).toBe(12);
    expect(r.taxAmount).toBe(0);
    expect(r.priceTotal).toBe(12);
  });

  it('excluded tax adds on top', () => {
    const r = computeLineTotals({ id: 'l', quantity: 1, priceUnit: 100, taxes: [excl10] });
    expect(r.priceSubtotal).toBe(100);
    expect(r.taxAmount).toBe(10);
    expect(r.priceTotal).toBe(110);
  });

  it('included tax is backed out of the unit price', () => {
    const r = computeLineTotals({ id: 'l', quantity: 1, priceUnit: 110, taxes: [incl10] });
    expect(r.priceSubtotal).toBe(100);
    expect(r.taxAmount).toBe(10);
    expect(r.priceTotal).toBe(110);
  });

  it('applies a percentage discount before tax', () => {
    // 2 x 50 = 100, less 20% = 80, +10% tax = 88
    const r = computeLineTotals({ id: 'l', quantity: 2, priceUnit: 50, discount: 20, taxes: [excl10] });
    expect(r.priceSubtotal).toBe(80);
    expect(r.taxAmount).toBe(8);
    expect(r.priceTotal).toBe(88);
  });

  it('sums multiple excluded taxes additively', () => {
    const r = computeLineTotals({ id: 'l', quantity: 1, priceUnit: 100, taxes: [excl10, excl5] });
    expect(r.priceSubtotal).toBe(100);
    expect(r.taxAmount).toBe(15);
    expect(r.priceTotal).toBe(115);
  });

  it('rounds to cents (1 x 9.99 @ 8.25% excl)', () => {
    const tax: Tax = { id: 'x', name: '8.25%', amount: 8.25, priceInclude: false };
    const r = computeLineTotals({ id: 'l', quantity: 1, priceUnit: 9.99, taxes: [tax] });
    expect(r.priceSubtotal).toBe(9.99);
    expect(r.taxAmount).toBe(0.82); // 9.99 * 0.0825 = 0.824175 → 0.82
    expect(r.priceTotal).toBe(10.81);
  });

  it('throws when mixing inclusion modes on one line', () => {
    expect(() =>
      computeLineTotals({ id: 'l', quantity: 1, priceUnit: 100, taxes: [excl10, incl10] }),
    ).toThrow();
  });

  it('clamps out-of-range discounts', () => {
    const r = computeLineTotals({ id: 'l', quantity: 1, priceUnit: 100, discount: 250 });
    expect(r.priceSubtotal).toBe(0);
  });
});

describe('computeOrderTotals', () => {
  it('aggregates lines and totals', () => {
    const r = computeOrderTotals([
      { id: 'a', quantity: 2, priceUnit: 50, taxes: [excl10] }, // sub 100, tax 10
      { id: 'b', quantity: 1, priceUnit: 20, taxes: [excl10] }, // sub 20, tax 2
      { id: 'c', quantity: 3, priceUnit: 4 }, // sub 12, tax 0
    ]);
    expect(r.subtotal).toBe(132);
    expect(r.taxTotal).toBe(12);
    expect(r.total).toBe(144);
  });

  it('groups the per-tax breakdown by tax id', () => {
    const r = computeOrderTotals([
      { id: 'a', quantity: 1, priceUnit: 100, taxes: [excl10, excl5] },
      { id: 'b', quantity: 1, priceUnit: 200, taxes: [excl10] },
    ]);
    const t10 = r.taxes.find((t) => t.taxId === 't10')!;
    const t5 = r.taxes.find((t) => t.taxId === 't5')!;
    expect(t10.base).toBe(300);
    expect(t10.amount).toBe(30);
    expect(t5.base).toBe(100);
    expect(t5.amount).toBe(5);
    expect(r.taxTotal).toBe(35);
    expect(r.total).toBe(335);
  });

  it('per-tax breakdown sums back to the tax total exactly', () => {
    const r = computeOrderTotals([
      { id: 'a', quantity: 1, priceUnit: 9.99, taxes: [excl10, excl5] },
      { id: 'b', quantity: 3, priceUnit: 3.33, taxes: [excl10, excl5] },
    ]);
    const sum = r.taxes.reduce((s, t) => s + t.amount, 0);
    expect(Math.abs(sum - r.taxTotal)).toBeLessThan(0.005);
  });

  it('handles an empty order', () => {
    const r = computeOrderTotals([]);
    expect(r.subtotal).toBe(0);
    expect(r.taxTotal).toBe(0);
    expect(r.total).toBe(0);
    expect(r.taxes).toEqual([]);
  });
});
