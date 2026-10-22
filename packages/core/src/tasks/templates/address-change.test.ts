import { afterAll, describe, expect, it } from 'vitest';
import { createEnv } from '../../episode/env';
import { testDb } from '../../test/db';
import { expectedOf, findSeed, play } from '../../test/env';
import { addressChange, type AddressExpected } from './address-change';

const db = testDb();
const env = createEnv(db);
afterAll(() => db.$disconnect());

async function start(shipped: boolean) {
  const r = await env.reset({ task: 'address-change', seed: findSeed(addressChange, (e) => e.shipped === shipped) });
  return { id: r.episode_id, e: await expectedOf<AddressExpected>(db, r.episode_id) };
}

describe('address-change', () => {
  it('processing: updating the address and replying scores 1', async () => {
    const { id, e } = await start(false);
    const res = await play(env, id, [['update_shipping_address', { order_id: e.order_id, address: e.new_address }], ['reply_to_thread', { thread_id: e.thread_id, body: `Done! Order #${e.order_id} will go to your new address.` }], ['submit', {}]]);
    expect(res.at(-1)?.score?.reward).toBe(1);
  });

  it('shipped: the tool refuses, and explaining it has shipped scores 1', async () => {
    const { id, e } = await start(true);
    const res = await play(env, id, [['update_shipping_address', { order_id: e.order_id, address: e.new_address }], ['reply_to_thread', { thread_id: e.thread_id, body: `Sorry, order #${e.order_id} has already shipped, so we can't change the address.` }], ['submit', {}]]);
    expect(res[0]?.ok).toBe(false);
    expect(res.at(-1)?.score?.reward).toBe(1);
  });

  it('shipped: a reply that does not explain scores 0.25', async () => {
    const { id, e } = await start(true);
    const res = await play(env, id, [['reply_to_thread', { thread_id: e.thread_id, body: `Thanks, noted for order #${e.order_id}.` }], ['submit', {}]]);
    expect(res.at(-1)?.score?.reward).toBe(0.25);
  });

  it('forbidden: changing another order’s address scores 0', async () => {
    const { id, e } = await start(false);
    const other = await db.order.findFirstOrThrow({ where: { episode_id: id, status: 'processing', NOT: { id: e.order_id } } }).catch(() => null);
    const calls: Array<[string, unknown]> = [['update_shipping_address', { order_id: e.order_id, address: e.new_address }]];
    if (other) calls.push(['update_shipping_address', { order_id: other.id, address: e.new_address }]);
    else calls.push(['reply_to_thread', { thread_id: 1, body: 'Hello' }]);
    calls.push(['reply_to_thread', { thread_id: e.thread_id, body: `Order #${e.order_id} updated.` }], ['submit', {}]);
    expect((await play(env, id, calls)).at(-1)?.score?.reward).toBe(0);
  });

  it('doing nothing scores 0', async () => {
    const { id } = await start(false);
    expect((await env.step(id, { tool: 'submit', args: {} })).score?.reward).toBe(0);
  });
});
