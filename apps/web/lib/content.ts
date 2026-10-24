import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TASKS } from '@backoffice-gym/core';
import type { Replay } from '@backoffice-gym/replay';

/** The recorded run set the site shows. */
export const RUN_SET = 'free-2026-10';

/** Repo root: the cwd when tests run from the root, two levels up when Next runs in apps/web. */
const repoRoot = (): string => (existsSync(join(process.cwd(), 'evals')) ? process.cwd() : join(process.cwd(), '..', '..'));
const replaysDir = (): string => join(repoRoot(), 'evals', 'replays', RUN_SET);

export interface RunSummary {
  id: string;
  model: string;
  task: string;
  seed: number;
  reward: number;
  /** The reward mcp-evals recorded; the replay must reproduce it. */
  recorded: number | null;
  steps: number;
}

let runsCache: RunSummary[] | null = null;

export function listRuns(): RunSummary[] {
  if (runsCache) return runsCache;
  const raw = JSON.parse(readFileSync(join(replaysDir(), 'index.json'), 'utf8')) as RunSummary[];
  const order = (slug: string) => TASKS.findIndex((t) => t.slug === slug);
  runsCache = raw
    .map(({ id, model, task, seed, reward, recorded, steps }) => ({ id, model, task, seed, reward, recorded, steps }))
    .sort((a, b) => order(a.task) - order(b.task) || a.model.localeCompare(b.model) || a.seed - b.seed);
  return runsCache;
}

/** A recorded run's replay. Only plain ids listed in the index are read. */
export function getReplay(id: string): Replay | null {
  if (!/^[a-z0-9]+$/i.test(id) || !listRuns().some((r) => r.id === id)) return null;
  const file = join(replaysDir(), `${id}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Replay) : null;
}

export const runsForTask = (slug: string): RunSummary[] => listRuns().filter((r) => r.task === slug);
export const models = (): string[] => [...new Set(listRuns().map((r) => r.model))].sort();
export const taskTitle = (slug: string): string => TASKS.find((t) => t.slug === slug)?.title ?? slug;

export interface HeatCell {
  model: string;
  task: string;
  passed: number;
  total: number;
}

export function heatmap(): HeatCell[] {
  const runs = listRuns();
  return models().flatMap((model) =>
    TASKS.map((t) => {
      const mine = runs.filter((r) => r.model === model && r.task === t.slug);
      return { model, task: t.slug, passed: mine.filter((r) => r.reward === 1).length, total: mine.length };
    }),
  );
}

/** The day the run set was recorded, from its mcp-evals results file. */
export function recordedOn(): string {
  const results = JSON.parse(readFileSync(join(repoRoot(), 'evals', 'runs', RUN_SET, 'results.json'), 'utf8')) as { startedAt: string };
  return results.startedAt.slice(0, 10);
}

export function stats() {
  const runs = listRuns();
  const cells = heatmap();
  return {
    runs: runs.length,
    models: models().length,
    tasks: TASKS.length,
    traps: TASKS.filter((t) => t.slug.endsWith('-trap')).length,
    perfect: runs.filter((r) => r.reward === 1).length,
    /** Replays whose reward matches the recorded one. */
    reproduced: runs.filter((r) => r.recorded === r.reward).length,
    /** Seeds per model × task (the same for every cell in this run set). */
    seedsPerCell: Math.max(0, ...cells.map((c) => c.total)),
    /** Tasks every recorded run solved. */
    perfectTasks: TASKS.filter((t) => cells.filter((c) => c.task === t.slug).every((c) => c.total > 0 && c.passed === c.total)).length,
    recordedOn: recordedOn(),
  };
}
