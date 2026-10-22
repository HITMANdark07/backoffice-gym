import { stableStringify } from '@shopgym/db';
import { describe, expect, it } from 'vitest';
import { isoDate } from '../util/time';
import { generateBaseStore } from './generate';

describe('generateBaseStore', () => {
  it('is deterministic for the same slug and seed', () => {
    const a = generateBaseStore('base', 7);
    const b = generateBaseStore('base', 7);
    expect(stableStringify(a.rows)).toBe(stableStringify(b.rows));
    expect(a.storeDate.getTime()).toBe(b.storeDate.getTime());
  });

  it('differs across seeds and across slugs', () => {
    const s = (slug: string, seed: number) => stableStringify(generateBaseStore(slug, seed).rows);
    expect(s('base', 7)).not.toBe(s('base', 8));
    expect(s('base', 7)).not.toBe(s('other', 7));
  });

  it('rejects bad seeds', () => {
    expect(() => generateBaseStore('base', -1)).toThrow(RangeError);
    expect(() => generateBaseStore('base', 1.5)).toThrow(RangeError);
  });

  it('keeps store invariants for many seeds', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { rows, storeDate } = generateBaseStore('base', seed);
      expect(rows.staff.find((s) => s.id === 1)).toMatchObject({ role: 'support', on_duty: true });
      expect(new Set(rows.products.map((p) => p.sku)).size).toBe(rows.products.length);
      expect(new Set(rows.customers.map((c) => c.email)).size).toBe(rows.customers.length);
      expect(rows.customers.every((c) => c.email.endsWith('@example.com'))).toBe(true);
      expect(rows.orders).toHaveLength(12);
      for (const o of rows.orders) {
        const items = rows.order_items.filter((i) => i.order_id === o.id);
        expect(items.reduce((s, i) => s + i.qty * i.unit_price_cents, 0)).toBe(o.total_cents);
        const pays = rows.payments.filter((p) => p.order_id === o.id);
        expect(pays.map((p) => p.amount_cents)).toEqual([o.total_cents]);
        if (o.delivered_on) expect(o.delivered_on.getTime()).toBeLessThanOrEqual(storeDate.getTime());
      }
      expect(rows.threads.every((t) => t.status === 'replied')).toBe(true);
      expect(rows.products.every((p) => p.stock >= p.reorder_threshold)).toBe(true);
      expect(rows.budget[0]?.month).toBe(isoDate(storeDate).slice(0, 7));
      expect(rows.policy[0]?.text).toMatch(/30 days/);
    }
  });
});
