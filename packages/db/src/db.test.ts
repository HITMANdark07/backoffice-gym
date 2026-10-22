import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb, testDatabaseUrl } from './index';

const db = createDb(testDatabaseUrl());
afterAll(() => db.$disconnect());

const pgCode = (e: unknown): string | undefined =>
  (e as { meta?: { driverAdapterError?: { cause?: { code?: string } } } }).meta?.driverAdapterError?.cause?.code;

async function newEpisode(): Promise<string> {
  const id = randomUUID();
  await db.episode.create({
    data: {
      id, task_slug: 'db-test', seed: 1, env_version: 1, store_date: new Date('2026-03-02T00:00:00Z'), owner: 'system',
      created_at: new Date(), expires_at: new Date(Date.now() + 60_000), initial_state_hash: '', initial_state: {}, expected: {},
    },
  });
  await db.customer.create({
    data: { episode_id: id, id: 1, name: 'Asha Rao', email: 'asha.rao1@example.com', tier: 'standard', created_on: new Date('2025-01-01T00:00:00Z') },
  });
  return id;
}

describe('shopgym schema', () => {
  it('keeps the same ids apart in different episodes', async () => {
    const a = await newEpisode();
    const b = await newEpisode();
    expect(await db.customer.count({ where: { episode_id: a } })).toBe(1);
    expect(await db.customer.count({ where: { episode_id: b } })).toBe(1);
  });

  it('rejects an order for a customer that does not exist in the episode (FK)', async () => {
    const a = await newEpisode();
    const err = await db.order
      .create({ data: { episode_id: a, id: 1001, customer_id: 99, status: 'processing', placed_on: new Date('2026-03-01T00:00:00Z'), shipping_address: 'x', total_cents: 100 } })
      .catch((e: unknown) => e);
    expect((err as { code?: string }).code).toBe('P2003');
  });

  it('enforces CHECK constraints (negative stock)', async () => {
    const a = await newEpisode();
    const err = await db.product
      .create({ data: { episode_id: a, id: 1, sku: 'X', name: 'X', unit_price_cents: 100, unit_cost_cents: 50, stock: -1, reorder_threshold: 5, reorder_qty: 20, supplier: 'S' } })
      .catch((e: unknown) => e);
    expect(pgCode(err)).toBe('23514');
  });

  it('round-trips IST wall time in timestamp(0) unchanged', async () => {
    const a = await newEpisode();
    await db.staff.create({ data: { episode_id: a, id: 1, name: 'Ravi', role: 'support', on_duty: true } });
    await db.calendarEvent.create({
      data: { episode_id: a, id: 1, staff_id: 1, title: 't', starts_at: new Date('2026-03-10T14:30:00Z'), ends_at: new Date('2026-03-10T15:00:00Z'), created_step: 0 },
    });
    const ev = await db.calendarEvent.findFirstOrThrow({ where: { episode_id: a } });
    expect(ev.starts_at.toISOString()).toBe('2026-03-10T14:30:00.000Z');
  });

  it('cascades episode deletes to every row', async () => {
    const a = await newEpisode();
    await db.episode.delete({ where: { id: a } });
    expect(await db.customer.count({ where: { episode_id: a } })).toBe(0);
  });
});
