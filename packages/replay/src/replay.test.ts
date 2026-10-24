import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createEnv, TASKS } from '@backoffice-gym/core';
import { createDb, testDatabaseUrl } from '@backoffice-gym/db';
import { afterAll, describe, expect, it } from 'vitest';
import { parseTaskId, replayableCalls, replayTrace, ReplayMismatchError, type TraceLike } from './replay';
import { readTraces } from './traces';

const db = createDb(testDatabaseUrl());
const env = createEnv(db);
afterAll(() => db.$disconnect());

const expected = (slug: string, seed: number) => TASKS.find((t) => t.slug === slug)!.generate(seed).expected as { thread_id: number };

function trace(calls: Array<{ tool: string; args: unknown; answered?: boolean }>, recorded: number | null = 1): TraceLike {
  const events: TraceLike['events'] = [];
  calls.forEach((c, i) => {
    events.push({ type: 'tool_call', callId: `c${i}`, tool: c.tool, args: c.args as Record<string, unknown> | null });
    if (c.answered !== false) events.push({ type: 'tool_result', callId: `c${i}`, tool: c.tool });
  });
  return {
    runKey: 'backoffice-gym/backoffice-gym/mock/perfect/refund-window-trap--s1#0', suite: 'backoffice-gym', server: 'backoffice-gym', model: 'mock/perfect',
    task: 'refund-window-trap--s1', outcome: 'pass',
    graders: recorded === null ? [] : [{ type: 'env_reward', value: recorded }], events,
  };
}

const goodCalls = () => [
  { tool: 'read_policy', args: {} },
  { tool: 'reply_to_thread', args: { thread_id: expected('refund-window-trap', 1).thread_id, body: 'Sorry, refunds are only possible within 30 days of delivery.' } },
  { tool: 'submit', args: {} },
];

describe('replay', () => {
  it('parses task ids', () => {
    expect(parseTaskId('damaged-item--s12')).toEqual({ task: 'damaged-item', seed: 12 });
    expect(() => parseTaskId('damaged-item')).toThrow(/--s<seed>/);
  });

  it('replays only calls that reached the server', () => {
    const t = trace([{ tool: 'read_policy', args: {} }, { tool: 'bogus', args: null, answered: false }]);
    expect(replayableCalls(t)).toEqual([{ tool: 'read_policy', args: {} }]);
  });

  it('rebuilds each step with its store changes and matches the recorded reward', async () => {
    const r = await replayTrace(env, db, trace(goodCalls()));
    expect(r).toMatchObject({ version: 1, env_version: 1, run: { task: 'refund-window-trap', seed: 1, recorded_reward: 1 }, score: { reward: 1 } });
    expect(r.steps.map((s) => s.tool)).toEqual(['read_policy', 'reply_to_thread', 'submit']);
    expect(r.steps[0]!.changes).toEqual([]);
    expect(r.steps[1]!.changes.map((c) => `${c.op} ${c.table}`)).toEqual(['change threads', 'add messages']);
    expect(r.prompt).toMatch(/Juniper Goods/);
  });

  it('keeps calls made after submit as errors', async () => {
    const r = await replayTrace(env, db, trace([...goodCalls(), { tool: 'read_policy', args: {} }]));
    expect(r.steps.at(-1)).toMatchObject({ ok: false, error: 'the episode is finished' });
  });

  it('refuses a replay whose reward differs from the recorded one', async () => {
    await expect(replayTrace(env, db, trace(goodCalls(), 0))).rejects.toBeInstanceOf(ReplayMismatchError);
    await expect(replayTrace(env, db, trace(goodCalls(), null))).resolves.toMatchObject({ run: { recorded_reward: null } });
  });

  it('reads plain and gzipped JSONL traces', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'traces-'));
    const text = `${JSON.stringify(trace(goodCalls()))}\n\n${JSON.stringify(trace([]))}\n`;
    await writeFile(join(dir, 't.jsonl'), text);
    await writeFile(join(dir, 't.jsonl.gz'), gzipSync(text));
    expect(await readTraces(join(dir, 't.jsonl'))).toHaveLength(2);
    expect(await readTraces(join(dir, 't.jsonl.gz'))).toHaveLength(2);
  });
});
