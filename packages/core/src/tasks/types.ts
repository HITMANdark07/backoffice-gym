import type { DiffEntry, Dump, Row, TableName } from '@backoffice-gym/db';
import type { StoreRows } from '../store/types';

export interface TaskInstance<E> {
  rows: StoreRows;
  storeDate: Date;
  prompt: string;
  /** Hidden from the agent. Stored on the episode for the scorer. Must be JSON-serializable. */
  expected: E;
}

export interface CheckContext<E> {
  expected: E;
  initial: Dump;
  final: Dump;
  diff: DiffEntry[];
  /** YYYY-MM-DD */
  storeDate: string;
}

export interface CheckDef<E> {
  id: string;
  kind: 'required' | 'forbidden';
  /** Required checks only; default 1. */
  weight?: number;
  /** Public wording (shown on task pages). Must not leak expected values. */
  description: string;
  evaluate(ctx: CheckContext<E>): { passed: boolean; detail: string };
}

export interface CheckResult {
  id: string;
  kind: 'required' | 'forbidden';
  weight: number;
  passed: boolean;
  detail: string;
}

export interface ScoreResult {
  reward: number;
  passed: boolean;
  checks: CheckResult[];
}

/** A change the task is allowed to make. `where` receives the row after the change (or before, for removals). */
export interface AllowRule {
  table: TableName;
  op: DiffEntry['op'];
  where(row: Row): boolean;
}

export interface TaskTemplate<E> {
  slug: string;
  title: string;
  summary: string;
  generate(seed: number): TaskInstance<E>;
  checks: CheckDef<E>[];
  allowed(expected: E): AllowRule[];
}

// Templates with different `expected` shapes live in one list.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTask = TaskTemplate<any>;
