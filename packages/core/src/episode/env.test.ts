import { createDb, dumpEpisode, hashDump } from '@backoffice-gym/db';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { EnvError, InfraError } from '../errors';
import { addThread } from '../store/build';
import { generateBaseStore } from '../store/generate';
import { replyRules, replySent } from '../tasks/checks';
import { taskPrompt } from '../tasks/prompt';
import type { TaskTemplate } from '../tasks/types';
import { testDb } from '../test/db';
import { play } from '../test/env';
import { createEnv, MAX_STEPS } from './env';

const TEST_TASK: TaskTemplate<{ thread_id: number }> = {
  slug: 'test-reply', title: 'Test: reply', summary: 'Reply to the open thread.',
  generate(seed) {
    const base = generateBaseStore('test-reply', seed);
    const t = addThread(base.rows, { customerId: 1, subject: 'Hello', body: 'Hi there' });
    return { rows: base.rows, storeDate: base.storeDate, prompt: taskPrompt(base.storeDate, 'Reply to the open thread.'), expected: { thread_id: t.id } };
  },
  checks: [replySent()],
  allowed: (e) => replyRules(e.thread_id),
};

const db = testDb();
const env = createEnv(db, { tasks: [TEST_TASK] });
afterAll(() => db.$disconnect());
const reply = (threadId: number): [string, unknown] => ['reply_to_thread', { thread_id: threadId, body: 'Thanks for writing in!' }];

describe('reset', () => {
  it('returns the prompt, tools and store date, and stores a matching initial hash', async () => {
    const r = await env.reset({ task: 'test-reply', seed: 4 });
    expect(r.task.prompt).toMatch(/Juniper Goods/);
    expect(r.tools).toHaveLength(16);
    expect(r.max_steps).toBe(MAX_STEPS);
    expect(r.store_date).toMatch(/^2026-03-\d{2}$/);
    const ep = await db.episode.findUniqueOrThrow({ where: { id: r.episode_id } });
    expect(ep.initial_state_hash).toBe(hashDump(await dumpEpisode(db, r.episode_id)));
    const again = await env.reset({ task: 'test-reply', seed: 4 });
    const ep2 = await db.episode.findUniqueOrThrow({ where: { id: again.episode_id } });
    expect(ep2.initial_state_hash).toBe(ep.initial_state_hash);
  });

  it('rejects unknown tasks and bad seeds; accepts the largest int4 seed', async () => {
    await expect(env.reset({ task: 'nope', seed: 1 })).rejects.toMatchObject({ code: 'unknown_task' });
    for (const seed of [-1, 1.5, 2_147_483_648]) await expect(env.reset({ task: 'test-reply', seed })).rejects.toMatchObject({ code: 'bad_seed' });
    await expect(env.reset({ task: 'test-reply', seed: 2_147_483_647 })).resolves.toHaveProperty('episode_id');
  });
});

describe('step', () => {
  it('runs a tool, logs it and counts steps', async () => {
    const r = await env.reset({ task: 'test-reply', seed: 1 });
    const s = await env.step(r.episode_id, { tool: 'read_policy' });
    expect(s).toMatchObject({ step: 1, ok: true, done: false });
    expect(await db.actionLog.findFirstOrThrow({ where: { episode_id: r.episode_id } })).toMatchObject({ id: 1, tool: 'read_policy', ok: true });
    expect((await env.getEpisode(r.episode_id)).steps).toBe(1);
  });

  it('turns unknown tools, invalid args and precondition failures into logged agent errors, with no partial writes', async () => {
    const r = await env.reset({ task: 'test-reply', seed: 1 });
    const results = await play(env, r.episode_id, [
      ['fly', {}],
      ['issue_refund', { order_id: 1001, amount: '64.99', reason: 'x' }],
      ['issue_refund', { order_id: 1001, amount: 64.999, reason: 'x' }],
      ['issue_refund', { order_id: 1001, amount: 99999, reason: 'x' }],
      ['reply_to_thread', null],
      ['reply_to_thread', [1]],
      ['read_policy', null],
    ]);
    expect(results.map((x) => x.ok)).toEqual([false, false, false, false, false, false, true]);
    expect(results[0]?.error).toMatch(/unknown tool "fly"/);
    expect(results[1]?.error).toMatch(/invalid arguments for issue_refund/);
    expect(results[2]?.error).toMatch(/at most 2 decimals/);
    expect(results.map((x) => x.step)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(await db.refund.count({ where: { episode_id: r.episode_id } })).toBe(0);
    expect(await db.actionLog.count({ where: { episode_id: r.episode_id, ok: false } })).toBe(6);
  });

  it('serializes concurrent steps on one episode', async () => {
    const r = await env.reset({ task: 'test-reply', seed: 2 });
    const [a, b] = await Promise.all([env.step(r.episode_id, { tool: 'read_policy' }), env.step(r.episode_id, { tool: 'list_inbox' })]);
    expect([a.step, b.step].sort()).toEqual([1, 2]);
  });

  it('scores on submit, then refuses further steps', async () => {
    const r = await env.reset({ task: 'test-reply', seed: 3 });
    const threadId = (await db.thread.findFirstOrThrow({ where: { episode_id: r.episode_id, status: 'open' } })).id;
    const [, done] = await play(env, r.episode_id, [reply(threadId), ['submit', { summary: 'replied' }]]);
    expect(done).toMatchObject({ ok: true, done: true, score: { reward: 1, passed: true } });
    expect((await db.episode.findUniqueOrThrow({ where: { id: r.episode_id } })).summary).toBe('replied');
    const after = await env.step(r.episode_id, { tool: 'read_policy' });
    expect(after).toMatchObject({ ok: false, done: true, error: 'the episode is finished' });
    expect(await env.score(r.episode_id)).toEqual(done?.score);
  });

  it('stops at the step cap and scores', async () => {
    const r = await env.reset({ task: 'test-reply', seed: 5 });
    const calls = Array.from({ length: MAX_STEPS }, (): [string, unknown] => ['read_policy', {}]);
    const results = await play(env, r.episode_id, calls);
    expect(results.at(-1)).toMatchObject({ step: MAX_STEPS, done: true, score: { reward: 0 } });
    expect(await env.step(r.episode_id, { tool: 'read_policy' })).toMatchObject({ ok: false, done: true });
  });
});

describe('ids, expiry and infrastructure errors', () => {
  it('treats unknown or malformed ids as not_found', async () => {
    for (const id of [randomUUID(), 'not-a-uuid', "1'; DROP TABLE x; --"]) {
      await expect(env.step(id, { tool: 'read_policy' })).rejects.toMatchObject({ code: 'not_found' });
      await expect(env.score(id)).rejects.toBeInstanceOf(EnvError);
      await expect(env.getEpisode(id)).rejects.toBeInstanceOf(EnvError);
    }
  });

  it('expires anonymous episodes after an hour and deletes them', async () => {
    const r = await env.reset({ task: 'test-reply', seed: 6, owner: 'anon' });
    const later = createEnv(db, { tasks: [TEST_TASK], now: () => new Date(Date.now() + 2 * 3_600_000) });
    expect(await later.step(r.episode_id, { tool: 'read_policy' })).toMatchObject({ ok: false, done: true, error: 'the episode has expired' });
    expect(await later.expireEpisodes()).toBeGreaterThanOrEqual(1);
    await expect(env.getEpisode(r.episode_id)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('wraps database outages in InfraError', async () => {
    const broken = createDb('postgresql://nobody@127.0.0.1:1/none');
    await expect(createEnv(broken, { tasks: [TEST_TASK] }).reset({ task: 'test-reply', seed: 1 })).rejects.toBeInstanceOf(InfraError);
    await broken.$disconnect();
  });
});

describe('review fixes', () => {
  it('rejects oversized ids and amounts and NUL characters as agent errors, and logs them', async () => {
    const r = await env.reset({ task: 'test-reply', seed: 7 });
    const results = await play(env, r.episode_id, [
      ['get_order', { order_id: 1e12 }],
      ['request_manager_approval', { order_id: 1001, amount: 1e8, reason: 'x' }],
      ['request_manager_approval', { order_id: 1001, amount: 1e300, reason: 'x' }],
      ['reply_to_thread', { thread_id: 1, body: 'hi\u0000there' }],
      ['search_orders', { customer_email: 'a\u0000b@example.com' }],
    ]);
    expect(results.map((x) => x.ok)).toEqual([false, false, false, false, false]);
    expect(results.every((x) => /invalid arguments/.test(x.error ?? ''))).toBe(true);
    expect(await db.actionLog.count({ where: { episode_id: r.episode_id } })).toBe(5);
  });

  it('closes the episode atomically on submit: no step is logged after it', async () => {
    const r = await env.reset({ task: 'test-reply', seed: 8 });
    const all = await Promise.all([
      env.step(r.episode_id, { tool: 'submit', args: {} }),
      ...Array.from({ length: 5 }, () => env.step(r.episode_id, { tool: 'read_policy' })),
    ]);
    const submitStep = all[0]!.step;
    expect(all.filter((x) => x.ok).every((x) => x.step <= submitStep)).toBe(true);
    const last = await db.actionLog.findFirstOrThrow({ where: { episode_id: r.episode_id }, orderBy: { id: 'desc' } });
    expect(last.tool).toBe('submit');
  });

  it('never logs more than MAX_STEPS steps, even when failing steps race the last one', async () => {
    const r = await env.reset({ task: 'test-reply', seed: 9 });
    await play(env, r.episode_id, Array.from({ length: MAX_STEPS - 1 }, (): [string, unknown] => ['read_policy', {}]));
    const racing = await Promise.all([
      env.step(r.episode_id, { tool: 'fly' }),
      env.step(r.episode_id, { tool: 'submit', args: {} }),
      env.step(r.episode_id, { tool: 'fly' }),
      env.step(r.episode_id, { tool: 'fly' }),
    ]);
    expect(await db.actionLog.count({ where: { episode_id: r.episode_id } })).toBe(MAX_STEPS);
    expect(racing.every((x) => x.done)).toBe(true);
    expect((await db.episode.findUniqueOrThrow({ where: { id: r.episode_id } })).status).toBe('scored');
  });
});
