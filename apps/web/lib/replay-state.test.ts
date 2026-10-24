import { emptyDump } from '@backoffice-gym/db';
import type { Replay } from '@backoffice-gym/replay';
import { describe, expect, it } from 'vitest';
import { getReplay, listRuns } from './content';
import { changedAt, firstFailingStep, scoreAt, stateAt } from './replay-state';
import { tabFor } from './store-tabs';

const score = (reward: number, forbiddenOk = true) => ({ reward, passed: reward === 1, checks: [{ id: 'f', kind: 'forbidden' as const, weight: 0, passed: forbiddenOk, detail: '' }] });

function synthetic(): Replay {
  const initial = emptyDump();
  initial.orders.push({ id: 1001, status: 'delivered', total_cents: 5400 }, { id: 1002, status: 'processing', total_cents: 100 });
  return {
    version: 2, env_version: 1, prompt: 'p', store_date: '2026-03-13', initial,
    run: { run_key: 'k', model: 'm', task: 'damaged-item', seed: 1, outcome: 'pass', recorded_reward: 1 },
    steps: [
      { n: 1, env_step: 1, tool: 'read_policy', args: {}, ok: true, result: {}, changes: [], score_after: score(0) },
      {
        n: 2, env_step: 2, tool: 'issue_refund', args: {}, ok: true, result: {}, score_after: score(0, false),
        changes: [
          { table: 'orders', op: 'change', id: 1001, before: { id: 1001, status: 'delivered', total_cents: 5400 }, after: { id: 1001, status: 'refunded', total_cents: 5400 }, fields: ['status'] },
          { table: 'refunds', op: 'add', id: 1, before: null, after: { id: 1, order_id: 1001, amount_cents: 5400 }, fields: [] },
          { table: 'orders', op: 'remove', id: 1002, before: { id: 1002 }, after: null, fields: [] },
        ],
      },
    ],
    score: score(0, false),
  };
}

describe('replay state', () => {
  it('rebuilds the store at any step without touching the initial snapshot', () => {
    const r = synthetic();
    expect(stateAt(r, 0).orders.map((o) => o.status)).toEqual(['delivered', 'processing']);
    const after = stateAt(r, 2);
    expect(after.orders).toEqual([{ id: 1001, status: 'refunded', total_cents: 5400 }]);
    expect(after.refunds).toHaveLength(1);
    expect(stateAt(r, 99)).toEqual(after);
    expect(stateAt(r, -5)).toEqual(stateAt(r, 0));
    expect(r.initial.orders).toHaveLength(2);
  });

  it('reports what a step changed, the score after it and the first failing step', () => {
    const r = synthetic();
    expect(changedAt(r, 0)).toEqual({});
    const ch = changedAt(r, 2);
    expect([...(ch.orders ?? [])].sort()).toEqual([1001, 1002]);
    expect([...(ch.refunds ?? [])]).toEqual([1]);
    expect(scoreAt(r, 0)).toBeNull();
    expect(scoreAt(r, 1)?.reward).toBe(0);
    expect(firstFailingStep(r)).toBe(2);
    expect(tabFor(ch)).toBe('orders');
    expect(tabFor({ messages: new Set([6]), threads: new Set([3]) })).toBe('inbox');
    expect(tabFor({ purchase_orders: new Set([1]), budget: new Set([1]) })).toBe('inventory');
    expect(tabFor({})).toBeNull();
  });

  it('replays a real run to a store consistent with its final score', () => {
    const run = listRuns().find((x) => x.task === 'damaged-item' && x.reward === 0)!;
    const r = getReplay(run.id)!;
    const end = stateAt(r, r.steps.length);
    expect(end.purchase_orders.length).toBe(1);
    expect(scoreAt(r, r.steps.length)).toEqual(r.score);
  });
});
