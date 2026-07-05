/*
 * COVERI POS — money & rounding helpers.
 *
 * All monetary math routes through here so rounding is consistent everywhere.
 * We work in floating point but round deterministically at defined boundaries,
 * mirroring how a POS must agree with the books to the cent.
 */

/** Round a value to `decimals` places using half-away-from-zero (banker-safe for retail). */
export function roundTo(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  // Nudge against binary FP error (e.g. 1.005) before rounding.
  const nudged = Math.round((value + Number.EPSILON * Math.sign(value)) * factor);
  return nudged / factor;
}

/** Format a number as a currency string. Symbol placement is intentionally simple for V1. */
export function formatMoney(
  value: number,
  opts: { currency?: string; decimals?: number; symbol?: string } = {},
): string {
  const { decimals = 2, symbol = '$' } = opts;
  const rounded = roundTo(value, decimals);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded).toFixed(decimals);
  const [intPart, decPart] = abs.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${symbol}${grouped}${decPart ? '.' + decPart : ''}`;
}
