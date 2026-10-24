export const money = (cents: unknown): string => `$${(Number(cents) / 100).toFixed(2)}`;
export const day = (iso: unknown): string => (typeof iso === 'string' ? iso.slice(0, 10) : '—');
export const time = (iso: unknown): string => (typeof iso === 'string' ? iso.slice(11, 16) : '');
export const pct = (n: number, d: number): string => (d === 0 ? '—' : `${Math.round((n / d) * 100)}%`);
export const rewardLabel = (r: number): string => (Number.isInteger(r) ? String(r) : String(Math.round(r * 100) / 100));
export const checkLabel = (id: string): string => {
  const words = id.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};
export const truncate = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}…` : s);
/** Tool arguments on one line, at most ~300 characters. */
export const formatArgs = (args: unknown): string => {
  const text = JSON.stringify(args ?? {}, null, 1).replace(/\n\s*/g, ' ');
  return text === '{}' ? '' : truncate(text, 300);
};
