import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb, diffDumps, dumpEpisode, emptyDump, hashDump, stableStringify, testDatabaseUrl } from './index';

describe('stableStringify / hashDump', () => {
  it('ignores key order and keeps array order', () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
    expect(stableStringify({ a: new Date('2026-03-02T00:00:00Z') })).toBe('{"a":"2026-03-02T00:00:00.000Z"}');
  });

  it('hashes equal dumps equally', () => {
    const a = emptyDump();
    a.customers.push({ id: 1, name: 'A' });
    const b = emptyDump();
    b.customers.push({ name: 'A', id: 1 });
    expect(hashDump(a)).toBe(hashDump(b));
  });
});

describe('diffDumps', () => {
  it('reports adds, removes and changed fields in table order', () => {
    const before = emptyDump();
    before.orders.push({ id: 1001, status: 'delivered' }, { id: 1002, status: 'processing' });
    const after = emptyDump();
    after.orders.push({ id: 1001, status: 'refunded' });
    after.refunds.push({ id: 1, order_id: 1001 });
    const diff = diffDumps(before, after);
    expect(diff.map((d) => `${d.op} ${d.table} ${d.id} ${d.fields.join('|')}`)).toEqual([
      'change orders 1001 status',
      'remove orders 1002 ',
      'add refunds 1 ',
    ]);
  });
});

describe('dumpEpisode', () => {
  const db = createDb(testDatabaseUrl());
  afterAll(() => db.$disconnect());

  it('dumps only this episode, ordered by id, without episode_id, dates as ISO strings', async () => {
    const ids = [randomUUID(), randomUUID()];
    for (const id of ids) {
      await db.episode.create({
        data: { id, task_slug: 't', seed: 1, env_version: 1, store_date: new Date('2026-03-02T00:00:00Z'), owner: 'system', created_at: new Date(), expires_at: new Date(Date.now() + 60_000), initial_state_hash: '', initial_state: {}, expected: {} },
      });
      await db.customer.createMany({
        data: [
          { episode_id: id, id: 2, name: 'B', email: `b-${id}@example.com`, tier: 'vip', created_on: new Date('2025-02-01T00:00:00Z') },
          { episode_id: id, id: 1, name: 'A', email: `a-${id}@example.com`, tier: 'standard', created_on: new Date('2025-01-01T00:00:00Z') },
        ],
      });
    }
    const dump = await dumpEpisode(db, ids[0]!);
    expect(dump.customers.map((c) => c.id)).toEqual([1, 2]);
    expect(dump.customers[0]).toEqual({ id: 1, name: 'A', email: `a-${ids[0]}@example.com`, tier: 'standard', created_on: '2025-01-01T00:00:00.000Z' });
    expect(dump.orders).toEqual([]);
  });
});
