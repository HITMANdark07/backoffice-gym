import { randomUUID } from 'node:crypto';
import { createEnv } from '@shopgym/core';
import { createDb, testDatabaseUrl } from '@shopgym/db';
import { afterAll, describe, expect, it } from 'vitest';
import { createApi } from './app';
import { createPgRateLimiter } from './rate-limit';

const db = createDb(testDatabaseUrl());
afterAll(() => db.$disconnect());
const HOUR = 3_600_000;

describe('createPgRateLimiter', () => {
  it('allows max hits per window, then reports when to retry; windows and keys are independent', async () => {
    let t = Date.parse('2026-03-10T10:15:00Z');
    const limiter = createPgRateLimiter(db, { episodes: { max: 3, windowMs: HOUR }, steps: { max: 1, windowMs: HOUR } }, () => new Date(t));
    const key = randomUUID();
    const hits = [];
    for (let i = 0; i < 4; i++) hits.push(await limiter.hit(key, 'episodes'));
    expect(hits.map((h) => h.ok)).toEqual([true, true, true, false]);
    expect(hits[3]!.retryAfterS).toBe(45 * 60);
    expect((await limiter.hit(randomUUID(), 'episodes')).ok).toBe(true);
    expect((await limiter.hit(key, 'steps')).ok).toBe(true);
    t += HOUR;
    expect((await limiter.hit(key, 'episodes')).ok).toBe(true);
  });

  it('prunes old windows', async () => {
    const old = createPgRateLimiter(db, undefined, () => new Date('2020-01-01T00:00:00Z'));
    await old.hit(randomUUID(), 'steps');
    expect(await createPgRateLimiter(db).prune()).toBeGreaterThanOrEqual(1);
  });

  it('makes the API answer 429 with retry-after for one client only', async () => {
    const limiter = createPgRateLimiter(db, { episodes: { max: 2, windowMs: HOUR }, steps: { max: 100, windowMs: HOUR } });
    const app = createApi({ env: createEnv(db), limiter, clientIp: (c) => c.req.header('x-test-ip') ?? 'none' });
    const a = randomUUID();
    const b = randomUUID();
    const reset = (ip: string) => app.request('/api/episodes', { method: 'POST', headers: { 'x-test-ip': ip }, body: JSON.stringify({ task: 'callback', seed: 1 }) });
    expect((await reset(a)).status).toBe(201);
    expect((await reset(a)).status).toBe(201);
    const third = await reset(a);
    expect(third.status).toBe(429);
    expect(Number(third.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await reset(b)).status).toBe(201);
  });
});
