import { describe, expect, it } from 'vitest';
import { createRng, fnv1a32, taskRng } from './rng';
import { addDays, at, dateOnly, daysBetween, formatWallTime, hhmm, humanDay, isoDate, parseWallTime } from './time';
import { dollars, formatMoney, toCents } from './money';

describe('rng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = createRng(7); const b = createRng(7); const c = createRng(8);
    const seq = (r: ReturnType<typeof createRng>) => Array.from({ length: 5 }, () => r.int(0, 1000));
    expect(seq(a)).toEqual(seq(b));
    expect(seq(createRng(7))).not.toEqual(seq(c));
  });
  it('int is inclusive and validates its range', () => {
    const r = createRng(1);
    const seen = new Set(Array.from({ length: 200 }, () => r.int(1, 3)));
    expect([...seen].sort()).toEqual([1, 2, 3]);
    expect(() => r.int(3, 1)).toThrow(RangeError);
  });
  it('pick, shuffle and chance', () => {
    const r = createRng(3);
    expect(() => r.pick([])).toThrow(RangeError);
    expect(r.shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
    expect(typeof r.chance(0.5)).toBe('boolean');
  });
  it('taskRng depends on slug and seed', () => {
    expect(fnv1a32('a')).not.toBe(fnv1a32('b'));
    expect(taskRng('x', 1).next()).toBe(taskRng('x', 1).next());
    expect(taskRng('x', 1).next()).not.toBe(taskRng('y', 1).next());
  });
});

describe('time (IST wall clock encoded as UTC)', () => {
  it('dates', () => {
    const d = dateOnly('2026-03-10');
    expect(isoDate(addDays(d, -10))).toBe('2026-02-28');
    expect(daysBetween(dateOnly('2026-02-01'), d)).toBe(37);
    expect(() => dateOnly('2026-02-30')).toThrow(RangeError);
    expect(humanDay(d)).toBe('Tue 10 Mar');
  });
  it('wall times', () => {
    const t = at(dateOnly('2026-03-10'), 14, 30);
    expect(formatWallTime(t)).toBe('2026-03-10T14:30');
    expect(hhmm(t)).toBe('14:30');
    expect(parseWallTime('2026-03-10T14:30')?.getTime()).toBe(t.getTime());
    for (const bad of ['2026-03-10 14:30', '2026-03-10T25:00', '2026-02-30T10:00', 'soon']) expect(parseWallTime(bad)).toBeNull();
  });
});

describe('money', () => {
  it('converts dollars to cents only with at most 2 decimals', () => {
    expect(toCents(64.99)).toBe(6499);
    expect(toCents(0.1 + 0.2)).toBe(30); // float noise is absorbed; real third decimals are not
    expect(toCents(64.999)).toBeNull();
    expect(toCents(0)).toBeNull();
    expect(toCents(-5)).toBeNull();
    expect(toCents(Number.NaN)).toBeNull();
    expect(dollars(6499)).toBe(64.99);
    expect(formatMoney(20000)).toBe('$200.00');
  });
});
