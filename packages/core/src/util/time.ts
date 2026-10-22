/**
 * Store times are IST wall-clock values. They are stored in `timestamp without time zone`
 * and carried in JS Dates with a zero offset, so `2026-03-10T14:30` IST is `2026-03-10T14:30:00.000Z`.
 */
export const STORE_TIMEZONE = 'Asia/Kolkata';
const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

export function dateOnly(iso: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new RangeError(`not a date: ${iso}`);
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || isoDate(d) !== iso) throw new RangeError(`not a date: ${iso}`);
  return d;
}

export const addDays = (d: Date, n: number): Date => new Date(d.getTime() + n * DAY_MS);
export const addMinutes = (d: Date, n: number): Date => new Date(d.getTime() + n * 60_000);
export const at = (day: Date, hour: number, minute = 0): Date => new Date(day.getTime() + (hour * 60 + minute) * 60_000);
export const daysBetween = (from: Date, to: Date): number => Math.round((to.getTime() - from.getTime()) / DAY_MS);

/** Parses `YYYY-MM-DDTHH:mm` (IST). Returns null for anything else. */
export function parseWallTime(text: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(text);
  if (!m) return null;
  const hour = Number(m[2]);
  const minute = Number(m[3]);
  if (hour > 23 || minute > 59) return null;
  try {
    return at(dateOnly(m[1] as string), hour, minute);
  } catch {
    return null;
  }
}

export const formatWallTime = (d: Date): string => d.toISOString().slice(0, 16);
export const hhmm = (d: Date): string => d.toISOString().slice(11, 16);
export const humanDay = (d: Date): string => `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
