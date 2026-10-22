/** Dollars to integer cents. Null unless the amount is positive, finite and has at most 2 decimals. */
export function toCents(amount: number): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round(amount * 100);
  return Math.abs(cents - amount * 100) < 1e-6 ? cents : null;
}

export const dollars = (cents: number): number => cents / 100;
export const formatMoney = (cents: number): string => `$${(cents / 100).toFixed(2)}`;
