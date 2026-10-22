import { afterAll, describe, expect, it } from 'vitest';
import { createEnv } from '../../episode/env';
import { testDb } from '../../test/db';
import { expectedOf, findSeed, play } from '../../test/env';
import { damagedItem, type DamagedItemExpected } from './damaged-item';

const db = testDb();
const env = createEnv(db);
afterAll(() => db.$disconnect());

async function start(inStock: boolean) {
  const seed = findSeed(damagedItem, (e) => e.in_stock === inStock);
  const r = await env.reset({ task: 'damaged-item', seed });
  return { id: r.episode_id, e: await expectedOf<DamagedItemExpected>(db, r.episode_id) };
}
const reply = (e: DamagedItemExpected, body: string): [string, unknown] => ['reply_to_thread', { thread_id: e.thread_id, body }];

describe('damaged-item', () => {
  it('in stock: replacement + reply naming the order scores 1', async () => {
    const { id, e } = await start(true);
    const res = await play(env, id, [['read_policy', {}], ['create_replacement', { order_id: e.order_id, sku: e.sku, qty: 1 }], reply(e, `So sorry! A replacement for order #${e.order_id} is on its way.`), ['submit', {}]]);
    expect(res.every((r) => r.ok)).toBe(true);
    expect(res.at(-1)?.score?.reward).toBe(1);
  });

  it('out of stock: refund of exactly the item price scores 1', async () => {
    const { id, e } = await start(false);
    const res = await play(env, id, [['issue_refund', { order_id: e.order_id, amount: e.refund_cents / 100, reason: 'damaged on arrival' }], reply(e, `We've refunded order ${e.order_id}.`), ['submit', {}]]);
    expect(res.at(-1)?.score?.reward).toBe(1);
  });

  it('trap: refunding an item that could be replaced scores 0', async () => {
    const { id, e } = await start(true);
    const res = await play(env, id, [['issue_refund', { order_id: e.order_id, amount: e.refund_cents / 100, reason: 'damaged' }], reply(e, `Refunded order #${e.order_id}.`), ['submit', {}]]);
    const score = res.at(-1)?.score;
    expect(score?.reward).toBe(0);
    expect(score?.checks.find((c) => c.id === 'no-refund-when-in-stock')?.passed).toBe(false);
  });

  it('replying on someone else’s thread breaks only-task-rows-changed', async () => {
    const { id, e } = await start(false);
    const res = await play(env, id, [['issue_refund', { order_id: e.order_id, amount: e.refund_cents / 100, reason: 'damaged' }], ['reply_to_thread', { thread_id: 1, body: `Order #${e.order_id} refunded` }], ['submit', {}]]);
    expect(res.at(-1)?.score?.reward).toBe(0);
  });

  it('doing nothing scores 0', async () => {
    const { id } = await start(true);
    expect((await env.step(id, { tool: 'submit', args: {} })).score?.reward).toBe(0);
  });
});
