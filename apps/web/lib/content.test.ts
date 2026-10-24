import { TASKS } from '@backoffice-gym/core';
import { describe, expect, it } from 'vitest';
import { getReplay, heatmap, listRuns, models, runsForTask, stats, taskTitle } from './content';
import { FEATURED, notesFor, resolveFeatured } from './featured';
import { checkLabel, formatArgs, money, rewardLabel, truncate } from './format';
import { modelLabel } from './models';

describe('content', () => {
  it('lists the 48 recorded runs in task order', () => {
    const runs = listRuns();
    expect(runs).toHaveLength(48);
    expect(runs[0]!.task).toBe(TASKS[0]!.slug);
    expect(runsForTask('callback')).toHaveLength(6);
    expect(models()).toEqual(['minimax/minimax-m3.1-flash:free', 'nvidia/nemotron-3-ultra-550b-a55b:free']);
  });

  it('loads v2 replays and refuses ids that are not plain run ids', () => {
    const r = getReplay(listRuns()[0]!.id)!;
    expect(r.version).toBe(2);
    expect(r.steps.length).toBeGreaterThan(0);
    for (const bad of ['zzz', '../index', '..%2Fx', 'a/b', '', 'index.json']) expect(getReplay(bad), bad).toBeNull();
  });

  it('aggregates the heatmap and stats from the data', () => {
    const cells = heatmap();
    expect(cells).toHaveLength(2 * TASKS.length);
    expect(cells.reduce((s, c) => s + c.total, 0)).toBe(48);
    expect(cells.reduce((s, c) => s + c.passed, 0)).toBe(listRuns().filter((r) => r.reward === 1).length);
    expect(stats()).toMatchObject({ runs: 48, models: 2, tasks: 8, traps: 3 });
    expect(taskTitle('damaged-item')).toBe('Damaged item');
  });
});

describe('featured runs', () => {
  it('resolve to real runs with the rewards and tool calls their captions claim', () => {
    const featured = resolveFeatured();
    expect(featured).toHaveLength(FEATURED.length);
    for (const f of featured) {
      expect(f.replay.score.reward, f.spec.headline).toBe(f.spec.expectReward);
      expect(Object.keys(f.notes)).toHaveLength(f.spec.notes.length);
      for (const [n, text] of Object.entries(f.notes)) {
        const step = f.replay.steps[Number(n) - 1]!;
        expect(f.spec.notes.find((x) => x.text === text)?.tool).toBe(step.tool);
      }
      expect(notesFor(f.id)).toEqual(f.notes);
    }
    expect(notesFor('nope')).toEqual({});
  });
});

describe('format', () => {
  it('formats money, rewards, labels and long text', () => {
    expect(money(5400)).toBe('$54.00');
    expect(rewardLabel(1)).toBe('1');
    expect(rewardLabel(0.75)).toBe('0.75');
    expect(checkLabel('only-task-rows-changed')).toBe('Only task rows changed');
    expect(truncate('x'.repeat(500), 10)).toBe(`${'x'.repeat(10)}…`);
    expect(formatArgs({})).toBe('');
    expect(formatArgs({ order_id: 1013, amount: 54 })).toBe('{ "order_id": 1013, "amount": 54 }');
    expect(formatArgs({ body: 'y'.repeat(1000) }).length).toBeLessThanOrEqual(301);
    expect(modelLabel('nvidia/nemotron-3-ultra-550b-a55b:free')).toBe('Nemotron 3 Ultra');
    expect(modelLabel('acme/some-model:free')).toBe('some-model');
  });
});
