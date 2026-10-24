import { createHash } from 'node:crypto';
import { stableStringify } from '@backoffice-gym/db';
import { afterAll, describe, expect, it } from 'vitest';
import { createEnv, ENV_VERSION } from './episode/env';
import { TASKS } from './tasks/registry';
import { testDb } from './test/db';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const seeds = Array.from({ length: 20 }, (_, i) => i + 1);

describe('task generators', () => {
  it('has the 8 templates of the spec, in order', () => {
    expect(TASKS.map((t) => t.slug)).toEqual([
      'damaged-item', 'refund-window-trap', 'restock-budget', 'address-change', 'approval-trap', 'duplicate-charge', 'callback', 'injection-trap',
    ]);
  });

  describe.each(TASKS.map((t) => [t.slug, t] as const))('%s', (_slug, task) => {
    it('is identical for the same seed (seeds 1–20)', () => {
      for (const seed of seeds) expect(stableStringify(task.generate(seed))).toBe(stableStringify(task.generate(seed)));
    });
    it('varies across seeds', () => {
      expect(new Set(seeds.map((s) => stableStringify(task.generate(s)))).size).toBeGreaterThan(15);
    });
    it('never leaks expected values into check descriptions', () => {
      const e = JSON.stringify(task.generate(1).expected);
      for (const c of task.checks) {
        expect(c.description.length).toBeGreaterThan(0);
        expect(e.includes(c.description)).toBe(false);
      }
    });
  });

  it(`golden instance hashes at seed 1 (ENV_VERSION ${ENV_VERSION}; bump it when these change)`, () => {
    expect({ env_version: ENV_VERSION, hashes: Object.fromEntries(TASKS.map((t) => [t.slug, sha(stableStringify(t.generate(1)))])) }).toMatchSnapshot();
  });
});

describe('reset is deterministic in the database', () => {
  const db = testDb();
  const env = createEnv(db);
  afterAll(() => db.$disconnect());

  it('two resets of the same task and seed store the same state hash (seeds 1–3, every task)', async () => {
    for (const task of TASKS) {
      for (const seed of [1, 2, 3]) {
        const a = await env.reset({ task: task.slug, seed });
        const b = await env.reset({ task: task.slug, seed });
        const [ea, eb] = await Promise.all([a, b].map((r) => db.episode.findUniqueOrThrow({ where: { id: r.episode_id } })));
        expect(ea!.initial_state_hash, `${task.slug}#${seed}`).toBe(eb!.initial_state_hash);
      }
    }
  });
});
