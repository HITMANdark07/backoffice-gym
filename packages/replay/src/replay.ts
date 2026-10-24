import { ENV_VERSION, type Env, type ScoreResult } from '@backoffice-gym/core';
import { diffDumps, dumpEpisode, type DiffEntry, type ShopDb } from '@backoffice-gym/db';

/** The subset of an mcp-evals trace line that replays need. */
export interface TraceLike {
  runKey: string;
  suite: string;
  server: string;
  model: string;
  task: string;
  outcome: string;
  graders: Array<{ type: string; value?: number }>;
  events: Array<{ type: string; callId?: string; tool?: string; args?: Record<string, unknown> | null }>;
}

export interface ReplayStep {
  n: number;
  tool: string;
  args: unknown;
  ok: boolean;
  result?: unknown;
  error?: string;
  /** Store rows this step added, removed or changed. */
  changes: DiffEntry[];
}

export interface Replay {
  version: 1;
  env_version: number;
  run: { run_key: string; model: string; task: string; seed: number; outcome: string; recorded_reward: number | null };
  prompt: string;
  store_date: string;
  steps: ReplayStep[];
  score: ScoreResult;
}

export class ReplayMismatchError extends Error {
  override name = 'ReplayMismatchError';
}

export function parseTaskId(id: string): { task: string; seed: number } {
  const m = /^([a-z0-9-]+?)--s(\d+)$/.exec(id);
  if (!m) throw new Error(`task id "${id}" is not <slug>--s<seed>`);
  return { task: m[1] as string, seed: Number(m[2]) };
}

/** Tool calls that reached the server: those with a tool_result. Unknown tools and invalid JSON never did. */
export function replayableCalls(trace: TraceLike): Array<{ tool: string; args: unknown }> {
  const answered = new Set(trace.events.filter((e) => e.type === 'tool_result').map((e) => e.callId));
  return trace.events
    .filter((e) => e.type === 'tool_call' && answered.has(e.callId))
    .map((e) => ({ tool: e.tool as string, args: e.args ?? {} }));
}

/** Re-runs a recorded run on a fresh episode with the same task and seed. Determinism makes the result identical. */
export async function replayTrace(env: Env, db: ShopDb, trace: TraceLike): Promise<Replay> {
  const { task, seed } = parseTaskId(trace.task);
  const reset = await env.reset({ task, seed, owner: 'system' });
  const id = reset.episode_id;
  const steps: ReplayStep[] = [];
  let before = await dumpEpisode(db, id);
  for (const call of replayableCalls(trace)) {
    const r = await env.step(id, { tool: call.tool, args: call.args });
    const after = await dumpEpisode(db, id);
    steps.push({ n: r.step, tool: call.tool, args: call.args, ok: r.ok, ...(r.ok ? { result: r.result } : { error: r.error }), changes: diffDumps(before, after) });
    before = after;
  }
  const score = await env.score(id);
  const recorded = trace.graders.find((g) => g.type === 'env_reward')?.value ?? null;
  if (recorded !== null && recorded !== score.reward) {
    throw new ReplayMismatchError(`${trace.runKey}: replayed reward ${score.reward} differs from recorded ${recorded}`);
  }
  return {
    version: 1,
    env_version: ENV_VERSION,
    run: { run_key: trace.runKey, model: trace.model, task, seed, outcome: trace.outcome, recorded_reward: recorded },
    prompt: reset.task.prompt,
    store_date: reset.store_date,
    steps,
    score,
  };
}
