import { createEnv, InfraError, type Env } from '@backoffice-gym/core';
import { createDb, testDatabaseUrl } from '@backoffice-gym/db';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createApi } from './app';

const db = createDb(testDatabaseUrl());
const env = createEnv(db);
const app = createApi({ env });
afterAll(() => db.$disconnect());

const post = (path: string, body: unknown, raw = false) =>
  app.request(`/api${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ? (body as string) : JSON.stringify(body) });

describe('RL API', () => {
  it('lists the 8 tasks with public check descriptions only', async () => {
    const res = await app.request('/api/tasks');
    expect(res.status).toBe(200);
    const { tasks } = (await res.json()) as { tasks: Array<{ slug: string; checks: Array<{ id: string; kind: string }> }> };
    expect(tasks).toHaveLength(8);
    expect(tasks[0]!.checks.map((c) => c.id)).toEqual(expect.arrayContaining(['correct-remedy', 'only-task-rows-changed', 'refunds-follow-policy']));
    expect(JSON.stringify(tasks)).not.toMatch(/expected|refund_cents|thread_id/);
  });

  it('runs an episode: reset, step, score, status', async () => {
    const reset = await post('/episodes', { task: 'refund-window-trap', seed: 2 });
    expect(reset.status).toBe(201);
    const ep = (await reset.json()) as { episode_id: string; seed: number; tools: unknown[]; task: { prompt: string } };
    expect(ep).toMatchObject({ seed: 2 });
    expect(ep.tools).toHaveLength(16);
    expect(JSON.stringify(ep)).not.toMatch(/"expected"/);
    const inbox = (await (await post(`/episodes/${ep.episode_id}/step`, { tool: 'list_inbox' })).json()) as { result: { threads: Array<{ thread_id: number }> } };
    await post(`/episodes/${ep.episode_id}/step`, { tool: 'reply_to_thread', args: { thread_id: inbox.result.threads[0]!.thread_id, body: 'Refunds are only possible within 30 days of delivery, sorry.' } });
    const done = (await (await post(`/episodes/${ep.episode_id}/step`, { tool: 'submit', args: {} })).json()) as { done: boolean; score: { reward: number } };
    expect(done).toMatchObject({ done: true, score: { reward: 1 } });
    expect(((await (await post(`/episodes/${ep.episode_id}/score`, {})).json()) as { reward: number }).reward).toBe(1);
    expect(((await (await app.request(`/api/episodes/${ep.episode_id}`)).json()) as { status: string; steps: number })).toMatchObject({ status: 'scored', steps: 3 });
  });

  it('picks a random seed when none is given', async () => {
    const ep = (await (await post('/episodes', { task: 'callback' })).json()) as { seed: number };
    expect(Number.isInteger(ep.seed)).toBe(true);
  });

  it('rejects bad input with 400 and unknown things with 404', async () => {
    expect((await post('/episodes', { task: 'nope', seed: 1 })).status).toBe(400);
    expect((await post('/episodes', { task: 'callback', seed: '7' })).status).toBe(400);
    expect((await post('/episodes', { task: 'callback', seed: 1.5 })).status).toBe(400);
    expect((await post('/episodes', {})).status).toBe(400);
    expect((await post('/episodes', '{not json', true)).status).toBe(400);
    expect((await post('/episodes', [1, 2])).status).toBe(400);
    expect((await post('/episodes/00000000-0000-4000-8000-000000000000/step', { tool: 'read_policy' })).status).toBe(404);
    expect((await post('/episodes/not-a-uuid/score', {})).status).toBe(404);
    expect((await app.request('/api/nope')).status).toBe(404);
    const reset = (await (await post('/episodes', { task: 'callback', seed: 1 })).json()) as { episode_id: string };
    expect((await post(`/episodes/${reset.episode_id}/step`, {})).status).toBe(400);
    const badArgs = (await (await post(`/episodes/${reset.episode_id}/step`, { tool: 'get_order', args: { order_id: 'x' } })).json()) as { ok: boolean };
    expect(badArgs.ok).toBe(false);
  });

  it('rejects bodies over 64 KB with 413', async () => {
    expect((await post('/episodes', { task: 'callback', pad: 'x'.repeat(70_000) })).status).toBe(413);
  });

  it('turns infrastructure errors into a generic 503', async () => {
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    const broken: Env = { ...env, reset: async () => { throw new InfraError('connect ECONNREFUSED 127.0.0.1:5432'); } };
    const res = await createApi({ env: broken }).request('/api/episodes', { method: 'POST', body: JSON.stringify({ task: 'callback', seed: 1 }) });
    expect(res.status).toBe(503);
    expect(JSON.stringify(await res.json())).not.toMatch(/ECONNREFUSED/);
  });

  it('logs the underlying cause of infrastructure errors for the server logs', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken: Env = { ...env, reset: async () => { throw new InfraError('connect ECONNREFUSED 127.0.0.1:5432'); } };
    await createApi({ env: broken }).request('/api/episodes', { method: 'POST', body: JSON.stringify({ task: 'callback', seed: 1 }) });
    expect(log.mock.calls.flat().map(String).join(' ')).toMatch(/ECONNREFUSED/);
    log.mockRestore();
  });

  it('logs unexpected errors too, while answering with a generic 500', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken: Env = { ...env, reset: async () => { throw new TypeError('boom at line 7'); } };
    const res = await createApi({ env: broken }).request('/api/episodes', { method: 'POST', body: JSON.stringify({ task: 'callback', seed: 1 }) });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/boom/);
    expect(log.mock.calls.flat().map(String).join(' ')).toMatch(/boom at line 7/);
    log.mockRestore();
  });

  it('health runs the read-only check and changes nothing', async () => {
    let checked = 0;
    const res = await createApi({ env, health: async () => { checked++; } }).request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(checked).toBe(1);
  });

  it('health answers 503 when the check fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await createApi({ env, health: async () => { throw new InfraError('db down'); } }).request('/api/health');
    expect(res.status).toBe(503);
    log.mockRestore();
  });

  describe('cron cleanup', () => {
    const call = (api: ReturnType<typeof createApi>, auth?: string) =>
      api.request('/api/cron/cleanup', auth === undefined ? {} : { headers: { authorization: auth } });

    it('refuses every call when no cron secret is configured', async () => {
      expect((await call(createApi({ env }))).status).toBe(401);
      expect((await call(createApi({ env }), 'Bearer ')).status).toBe(401);
      expect((await call(createApi({ env, cronSecret: '' }), 'Bearer ')).status).toBe(401);
    });

    it('logs that CRON_SECRET is missing when it refuses a call for that reason', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      await call(createApi({ env }), 'Bearer anything');
      expect(log.mock.calls.flat().map(String).join(' ')).toMatch(/CRON_SECRET is not set/);
      log.mockRestore();
    });

    it('refuses a missing or wrong bearer token', async () => {
      const api = createApi({ env, cronSecret: 's3cret-value' });
      expect((await call(api)).status).toBe(401);
      expect((await call(api, 'Bearer wrong')).status).toBe(401);
      expect((await call(api, 's3cret-value')).status).toBe(401);
    });

    it('expires old episodes and runs the extra cleanup with the right token', async () => {
      let cleaned = 0;
      const api = createApi({ env, cronSecret: 's3cret-value', onCleanup: async () => { cleaned++; } });
      const res = await call(api, 'Bearer s3cret-value');
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true, expired_episodes: expect.any(Number) });
      expect(cleaned).toBe(1);
    });
  });
});
