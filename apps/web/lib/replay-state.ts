import type { ScoreResult } from '@backoffice-gym/core';
import type { DiffEntry, Dump, Row, TableName } from '@backoffice-gym/db';
import type { Replay } from '@backoffice-gym/replay';

/** Row ids a step changed, per table. */
export type Changed = Partial<Record<TableName, Set<number>>>;

type Steps = Pick<Replay, 'initial' | 'steps'>;

const clampStep = (r: Steps, step: number): number => Math.max(0, Math.min(Math.trunc(step), r.steps.length));

function apply(state: Dump, c: DiffEntry): void {
  const rest = (state[c.table] ?? []).filter((row) => Number(row.id) !== c.id);
  state[c.table] = c.op === 'remove' ? rest : [...rest, c.after as Row].sort((a, b) => Number(a.id) - Number(b.id));
}

/** The store after `step` steps (0 = the store at reset). */
export function stateAt(replay: Steps, step: number): Dump {
  const state = structuredClone(replay.initial) as Dump;
  const upto = clampStep(replay, step);
  for (let i = 0; i < upto; i++) for (const c of replay.steps[i]!.changes) apply(state, c);
  return state;
}

export function changedAt(replay: Steps, step: number): Changed {
  if (step < 1 || step > replay.steps.length) return {};
  const out: Changed = {};
  for (const c of replay.steps[step - 1]!.changes) (out[c.table] ??= new Set<number>()).add(c.id);
  return out;
}

export function scoreAt(replay: Pick<Replay, 'steps'>, step: number): ScoreResult | null {
  if (step < 1 || replay.steps.length === 0) return null;
  return replay.steps[Math.min(step, replay.steps.length) - 1]!.score_after;
}

/** The first step after which a forbidden check fails (reward 0 from then on), or null. */
export function firstFailingStep(replay: Pick<Replay, 'steps'>): number | null {
  const i = replay.steps.findIndex((s) => s.score_after.checks.some((c) => c.kind === 'forbidden' && !c.passed));
  return i === -1 ? null : i + 1;
}
