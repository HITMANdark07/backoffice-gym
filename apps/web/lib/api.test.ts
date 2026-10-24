import { randomUUID } from 'node:crypto';
import { createDb, testDatabaseUrl } from '@backoffice-gym/db';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApi } from './api';

const db = createDb(testDatabaseUrl());
afterAll(() => db.$disconnect());

/** Uses up an address's 30 episodes for the current hour. */
async function exhaust(ip: string) {
  const start = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
  await db.$executeRawUnsafe(
    `INSERT INTO "backoffice_gym"."rate_limits" (key, bucket, window_start, count) VALUES ($1, 'episodes', $2, 30)`,
    ip,
    start,
  );
}

const startEpisode = (app: ReturnType<typeof buildApi>, ip: string) =>
  app.request('/api/episodes', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': ip },
    body: JSON.stringify({ task: 'callback', seed: 1 }),
  });

describe('buildApi', () => {
  it('returns 429 with retry-after once an address has started 30 episodes this hour, when the limiter is on', async () => {
    const ip = `test-${randomUUID()}`;
    await exhaust(ip);
    const res = await startEpisode(buildApi(db, { BACKOFFICE_GYM_RATE_LIMIT: 'on' }), ip);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toMatch(/^\d+$/);
  });

  it('counts each address separately', async () => {
    const used = `test-${randomUUID()}`;
    await exhaust(used);
    const res = await startEpisode(buildApi(db, { BACKOFFICE_GYM_RATE_LIMIT: 'on' }), `test-${randomUUID()}`);
    expect(res.status).toBe(201);
  });

  it.each([{}, { BACKOFFICE_GYM_RATE_LIMIT: 'true' }, { BACKOFFICE_GYM_RATE_LIMIT: 'ON ' }])('does not limit unless the flag is exactly "on" (%j)', async (env) => {
    const ip = `test-${randomUUID()}`;
    await exhaust(ip);
    const res = await startEpisode(buildApi(db, env), ip);
    expect(res.status).toBe(201);
  });

  it('records new episodes as anonymous', async () => {
    const res = await startEpisode(buildApi(db, {}), `test-${randomUUID()}`);
    const { episode_id } = (await res.json()) as { episode_id: string };
    const rows = await db.$queryRawUnsafe<Array<{ owner: string }>>(`SELECT owner FROM "backoffice_gym"."episodes" WHERE id = $1::uuid`, episode_id);
    expect(rows[0]?.owner).toBe('anon');
  });
});
