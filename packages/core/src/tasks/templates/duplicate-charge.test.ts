import { afterAll, describe, expect, it } from 'vitest';
import { createEnv } from '../../episode/env';
import { testDb } from '../../test/db';
import { expectedOf, findSeed, play } from '../../test/env';
import { duplicateCharge, type DuplicateExpected } from './duplicate-charge';

const db = testDb();
const env = createEnv(db);
afterAll(() => db.$disconnect());

async function start(seed = 1) {
  const r = await env.reset({ task: 'duplicate-charge', seed });
  return { id: r.episode_id, e: await expectedOf<DuplicateExpected>(db, r.episode_id) };
}
const reply = (e: DuplicateExpected): [string, unknown] => ['reply_to_thread', { thread_id: e.thread_id, body: `We've refunded the duplicate charge on order #${e.order_id}.` }];

describe('duplicate-charge', () => {
  it('refunding the duplicate payment by id scores 1, even outside the 30-day window', async () => {
    const seed = findSeed(duplicateCharge, (e) => e.days_since_delivery !== null && e.days_since_delivery > 30);
    const { id, e } = await start(seed);
    const res = await play(env, id, [['issue_refund', { order_id: e.order_id, amount: e.amount_cents / 100, reason: 'duplicate charge', payment_id: e.duplicate_payment_id }], reply(e), ['submit', {}]]);
    expect(res.at(-1)?.score?.reward).toBe(1);
  });

  it('trap: a refund without payment_id hits the original payment and scores 0', async () => {
    const { id, e } = await start();
    const res = await play(env, id, [['issue_refund', { order_id: e.order_id, amount: e.amount_cents / 100, reason: 'duplicate' }], reply(e), ['submit', {}]]);
    expect(res.at(-1)?.score?.checks.find((c) => c.id === 'original-untouched')?.passed).toBe(false);
    expect(res.at(-1)?.score?.reward).toBe(0);
  });

  it('keeps every order total at or under $200 and doing nothing scores 0', async () => {
    for (let seed = 1; seed <= 20; seed++) expect(duplicateCharge.generate(seed).expected.amount_cents).toBeLessThanOrEqual(20000);
    const { id } = await start();
    expect((await env.step(id, { tool: 'submit', args: {} })).score?.reward).toBe(0);
  });
});
