import { afterAll, describe, expect, it } from 'vitest';
import { createEnv } from '../../episode/env';
import { testDb } from '../../test/db';
import { expectedOf, play } from '../../test/env';
import type { RestockExpected } from './restock-budget';

const db = testDb();
const env = createEnv(db);
afterAll(() => db.$disconnect());

async function start(seed = 1) {
  const r = await env.reset({ task: 'restock-budget', seed });
  return { id: r.episode_id, e: await expectedOf<RestockExpected>(db, r.episode_id) };
}
const orders = (e: RestockExpected, qty?: number): Array<[string, unknown]> => e.low.map((p) => ['create_purchase_order', { sku: p.sku, qty: qty ?? p.qty }]);

describe('restock-budget', () => {
  it('has 2–4 low products that check_inventory reports', async () => {
    const { id, e } = await start();
    expect(e.low.length).toBeGreaterThanOrEqual(2);
    expect(e.low.length).toBeLessThanOrEqual(4);
    const inv = await env.step(id, { tool: 'check_inventory', args: { below_threshold: true } });
    expect((inv.result as { products: Array<{ sku: string }> }).products.map((p) => p.sku).sort()).toEqual(e.low.map((p) => p.sku).sort());
  });

  it('one purchase order per low product at its reorder quantity scores 1', async () => {
    const { id, e } = await start();
    expect((await play(env, id, [...orders(e), ['submit', {}]])).at(-1)?.score?.reward).toBe(1);
  });

  it('wrong quantities score 0.5', async () => {
    const { id, e } = await start();
    expect((await play(env, id, [...orders(e, 5), ['submit', {}]])).at(-1)?.score?.reward).toBe(0.5);
  });

  it('trap: ordering a product that is not low scores 0', async () => {
    const { id, e } = await start();
    const res = await play(env, id, [...orders(e), ['create_purchase_order', { sku: 'ESPRESSO-1', qty: 1 }], ['submit', {}]]);
    expect(res.at(-1)?.score?.checks.find((c) => c.id === 'no-unneeded-orders')?.passed).toBe(false);
    expect(res.at(-1)?.score?.reward).toBe(0);
  });

  it('doing nothing scores 0', async () => {
    const { id } = await start();
    expect((await env.step(id, { tool: 'submit', args: {} })).score?.reward).toBe(0);
  });
});
