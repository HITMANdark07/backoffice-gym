import { afterAll, describe, expect, it } from 'vitest';
import { ToolError } from '../errors';
import { addOrder, addThread, nextId } from '../store/build';
import { generateBaseStore } from '../store/generate';
import { seedEpisode, testDb } from '../test/db';
import { runTool } from '../test/tools';
import { addDays } from '../util/time';
import { getTool, TOOLS } from './index';

const db = testDb();
afterAll(() => db.$disconnect());

/** A base store plus known fixtures. Each test gets its own episode. */
async function fixture() {
  const { rows, storeDate } = generateBaseStore('act-tools', 1);
  const mug = rows.products.find((p) => p.sku === 'MUG-SET-4')!;
  mug.stock = 3;
  const lamp = rows.products.find((p) => p.sku === 'LAMP-BRS')!;
  lamp.stock = 0;
  const delivered = addOrder(rows, { customerId: 1, items: [{ productId: mug.id, qty: 1 }, { productId: lamp.id, qty: 1 }], status: 'delivered', deliveredOn: addDays(storeDate, -3), address: '1 Test Road, Pune 411001' });
  const processing = addOrder(rows, { customerId: 2, items: [{ productId: mug.id, qty: 1 }], status: 'processing', placedOn: storeDate, address: '2 Test Road, Pune 411001' });
  const dup = addOrder(rows, { customerId: 3, items: [{ productId: mug.id, qty: 1 }], status: 'delivered', deliveredOn: addDays(storeDate, -2), address: '3 Test Road, Pune 411001' });
  rows.payments.push({ id: nextId(rows.payments), order_id: dup.id, amount_cents: dup.total_cents, captured_on: dup.placed_on, status: 'captured' });
  const thread = addThread(rows, { customerId: 1, subject: 'Help', body: 'Hello' });
  const ep = await seedEpisode(db, rows, storeDate);
  const call = (name: string, args: unknown, step = 1) => runTool(db, ep, storeDate, name, args, step);
  return { ep, rows, storeDate, mug, lamp, delivered, processing, dup, thread, call };
}

describe('action tools', () => {
  it('has 16 tools in total', () => {
    expect(TOOLS).toHaveLength(16);
    expect(getTool('submit')?.kind).toBe('end');
  });

  it('issue_refund: full refund marks payment and order refunded', async () => {
    const f = await fixture();
    const r = await f.call('issue_refund', { order_id: f.delivered.id, amount: f.delivered.total_cents / 100, reason: 'damaged' }, 4);
    expect(r).toMatchObject({ order_id: f.delivered.id, order_status: 'refunded' });
    const refund = await db.refund.findFirstOrThrow({ where: { episode_id: f.ep } });
    expect(refund).toMatchObject({ amount_cents: f.delivered.total_cents, created_step: 4 });
    expect((await db.payment.findFirstOrThrow({ where: { episode_id: f.ep, order_id: f.delivered.id } })).status).toBe('refunded');
  });

  it('issue_refund: partial refund marks the order partially_refunded', async () => {
    const f = await fixture();
    expect((await f.call('issue_refund', { order_id: f.delivered.id, amount: 10, reason: 'goodwill' })).order_status).toBe('partially_refunded');
  });

  it('issue_refund: rejects bad amounts, over-refunds and foreign payments', async () => {
    const f = await fixture();
    await expect(f.call('issue_refund', { order_id: f.delivered.id, amount: 64.999, reason: 'x' })).rejects.toThrow(/at most 2 decimals/);
    await expect(f.call('issue_refund', { order_id: f.delivered.id, amount: 100000, reason: 'x' })).rejects.toThrow(ToolError);
    const foreign = f.rows.payments.find((p) => p.order_id === f.processing.id)!;
    await expect(f.call('issue_refund', { order_id: f.delivered.id, amount: 1, reason: 'x', payment_id: foreign.id })).rejects.toThrow(/does not belong/);
    expect(getTool('issue_refund')!.input.safeParse({ order_id: f.delivered.id, amount: '64.99', reason: 'x' }).success).toBe(false);
  });

  it('issue_refund: refunding the duplicate payment leaves the order status alone', async () => {
    const f = await fixture();
    const [, second] = f.rows.payments.filter((p) => p.order_id === f.dup.id);
    const r = await f.call('issue_refund', { order_id: f.dup.id, amount: f.dup.total_cents / 100, reason: 'duplicate', payment_id: second!.id });
    expect(r).toMatchObject({ payment_id: second!.id, order_status: 'delivered' });
  });

  it('issue_refund without payment_id refunds the first payment with enough left', async () => {
    const f = await fixture();
    const [first] = f.rows.payments.filter((p) => p.order_id === f.dup.id);
    expect((await f.call('issue_refund', { order_id: f.dup.id, amount: 5, reason: 'x' })).payment_id).toBe(first!.id);
  });

  it('create_replacement decrements stock and checks the order and stock', async () => {
    const f = await fixture();
    expect(await f.call('create_replacement', { order_id: f.delivered.id, sku: 'MUG-SET-4', qty: 1 })).toMatchObject({ stock_left: 2 });
    await expect(f.call('create_replacement', { order_id: f.delivered.id, sku: 'LAMP-BRS', qty: 1 })).rejects.toThrow(/out of stock/);
    await expect(f.call('create_replacement', { order_id: f.delivered.id, sku: 'RUG-JUTE', qty: 1 })).rejects.toThrow(/does not contain/);
    await expect(f.call('create_replacement', { order_id: f.delivered.id, sku: 'MUG-SET-4', qty: 2 })).rejects.toThrow(/has only 1/);
  });

  it('update_shipping_address works only before shipping', async () => {
    const f = await fixture();
    expect((await f.call('update_shipping_address', { order_id: f.processing.id, address: '9 New Lane, Kochi 682001' })).shipping_address).toBe('9 New Lane, Kochi 682001');
    await expect(f.call('update_shipping_address', { order_id: f.delivered.id, address: '9 New Lane, Kochi 682001' })).rejects.toThrow(/can no longer be changed/);
  });

  it('create_purchase_order records cost and adds to budget spent', async () => {
    const f = await fixture();
    const before = f.rows.budget[0]!;
    const r = await f.call('create_purchase_order', { sku: 'MUG-SET-4', qty: 20 });
    expect(r).toMatchObject({ sku: 'MUG-SET-4', qty: 20, total: (20 * f.mug.unit_cost_cents) / 100 });
    expect((await db.budget.findFirstOrThrow({ where: { episode_id: f.ep } })).spent_cents).toBe(before.spent_cents + 20 * f.mug.unit_cost_cents);
    await expect(f.call('create_purchase_order', { sku: 'NOPE', qty: 1 })).rejects.toThrow(/no product/);
  });

  it('schedule_event parses IST times and validates staff and customer', async () => {
    const f = await fixture();
    const day = f.storeDate.toISOString().slice(0, 10);
    expect(await f.call('schedule_event', { staff_id: 1, starts_at: `${day}T16:00`, minutes: 30, title: 'Callback', customer_id: 1 })).toMatchObject({ starts_at: `${day}T16:00`, ends_at: `${day}T16:30` });
    await expect(f.call('schedule_event', { staff_id: 1, starts_at: `${day} 16:00`, minutes: 30, title: 'x' })).rejects.toThrow(/2026-03-10T14:30/);
    await expect(f.call('schedule_event', { staff_id: 99, starts_at: `${day}T16:00`, minutes: 30, title: 'x' })).rejects.toThrow(/staff 99/);
    await expect(f.call('schedule_event', { staff_id: 1, starts_at: `${day}T16:00`, minutes: 30, title: 'x', customer_id: 99 })).rejects.toThrow(/customer 99/);
  });

  it('request_manager_approval creates a pending approval', async () => {
    const f = await fixture();
    expect(await f.call('request_manager_approval', { order_id: f.delivered.id, amount: 153.99, reason: 'damaged' })).toMatchObject({ status: 'pending', amount: 153.99 });
  });

  it('reply_to_thread stores the body exactly (emoji, Devanagari) and marks the thread replied', async () => {
    const f = await fixture();
    const body = 'नमस्ते! Your replacement is on its way 📦 — order #1013.';
    await f.call('reply_to_thread', { thread_id: f.thread.id, body }, 2);
    const msg = await db.message.findFirstOrThrow({ where: { episode_id: f.ep, author: 'agent' } });
    expect(msg).toMatchObject({ body, sent_step: 2 });
    expect((await db.thread.findFirstOrThrow({ where: { episode_id: f.ep, id: f.thread.id } })).status).toBe('replied');
    expect(getTool('reply_to_thread')!.input.safeParse({ thread_id: 1, body: 'x'.repeat(4001) }).success).toBe(false);
  });

  it('submit returns submitted', async () => {
    const f = await fixture();
    expect(await f.call('submit', {})).toEqual({ submitted: true });
  });
});
