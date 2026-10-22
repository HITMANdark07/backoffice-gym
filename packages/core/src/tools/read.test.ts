import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ToolError } from '../errors';
import { generateBaseStore } from '../store/generate';
import { seedEpisode, testDb } from '../test/db';
import { runTool } from '../test/tools';
import { getTool, toolSchemas } from './index';

const db = testDb();
const { rows, storeDate } = generateBaseStore('read-tools', 5);
let ep = '';
const call = (name: string, args: unknown) => runTool(db, ep, storeDate, name, args);

beforeAll(async () => {
  ep = await seedEpisode(db, rows, storeDate);
});
afterAll(() => db.$disconnect());

describe('read tools', () => {
  it('read_policy returns the policy text', async () => {
    expect((await call('read_policy', {})).policy).toMatch(/within 30 days of the delivery date/);
  });

  it('list_inbox defaults to open threads; all shows answered ones too', async () => {
    expect((await call('list_inbox', {})).threads).toEqual([]);
    const all = (await call('list_inbox', { status: 'all' })).threads;
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({ thread_id: 1, subject: 'Gift wrapping', status: 'replied', messages: 2 });
  });

  it('read_thread returns messages and fails clearly for unknown threads', async () => {
    const t = await call('read_thread', { thread_id: 1 });
    expect(t.messages.map((m: { author: string }) => m.author)).toEqual(['customer', 'staff']);
    await expect(call('read_thread', { thread_id: 999 })).rejects.toThrow(ToolError);
  });

  it('search_orders filters by order id and by customer email (case-insensitive)', async () => {
    const first = rows.orders[0]!;
    const customer = rows.customers.find((c) => c.id === first.customer_id)!;
    expect((await call('search_orders', { order_id: first.id })).orders).toEqual([
      expect.objectContaining({ order_id: first.id, total: first.total_cents / 100 }),
    ]);
    const byEmail = await call('search_orders', { customer_email: customer.email.toUpperCase() });
    expect(byEmail.orders.every((o: { customer_id: number }) => o.customer_id === customer.id)).toBe(true);
    expect((await call('search_orders', {})).truncated).toBe(false);
  });

  it('get_order includes items, payments and days since delivery', async () => {
    const delivered = rows.orders.find((o) => o.status === 'delivered')!;
    const o = await call('get_order', { order_id: delivered.id });
    expect(o.payments).toHaveLength(1);
    expect(o.items.reduce((s: number, i: { qty: number; unit_price: number }) => s + i.qty * i.unit_price * 100, 0)).toBeCloseTo(delivered.total_cents);
    expect(o.days_since_delivery).toBeGreaterThan(0);
    await expect(call('get_order', { order_id: 1 })).rejects.toThrow(/order 1 not found/);
  });

  it('get_customer needs an id or an email', async () => {
    const c = rows.customers[0]!;
    expect((await call('get_customer', { email: c.email })).customer_id).toBe(c.id);
    expect(getTool('get_customer')!.input.safeParse({}).success).toBe(false);
  });

  it('check_inventory shows stock and the remaining restock budget', async () => {
    const inv = await call('check_inventory', {});
    expect(inv.products).toHaveLength(13);
    expect(inv.restock_budget.remaining).toBe((150_000 - rows.budget[0]!.spent_cents) / 100);
    expect((await call('check_inventory', { below_threshold: true })).products).toEqual([]);
    await expect(call('check_inventory', { sku: 'NOPE' })).rejects.toThrow(/no product with sku NOPE/);
  });

  it('list_calendar lists staff and events in a range, and rejects bad times', async () => {
    const day = storeDate.toISOString().slice(0, 10);
    const cal = await call('list_calendar', { from: `${day}T00:00`, to: `${day}T23:59` });
    expect(cal.staff).toHaveLength(4);
    expect(cal.events.length).toBeGreaterThan(0);
    await expect(call('list_calendar', { from: 'tomorrow', to: `${day}T23:59` })).rejects.toThrow(/2026-03-10T09:00/);
  });

  it('every tool has a JSON schema without $schema', () => {
    const schemas = toolSchemas();
    expect(schemas.map((s) => s.name)).toContain('list_calendar');
    expect(schemas.every((s) => s.input_schema.type === 'object' && !('$schema' in s.input_schema))).toBe(true);
  });
});
