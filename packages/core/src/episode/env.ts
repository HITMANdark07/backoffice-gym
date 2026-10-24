import { createHash, randomUUID } from 'node:crypto';
import { diffDumps, dumpEpisode, hashDump, stableStringify, toJson, type Dump, type ShopDb, type Tx } from '@backoffice-gym/db';
import { z } from 'zod';
import { constraintMessage, EnvError, InfraError, ToolError } from '../errors';
import { scoreTask } from '../scoring/score';
import { insertRows } from '../store/insert';
import { TASKS } from '../tasks/registry';
import type { AnyTask, ScoreResult } from '../tasks/types';
import { getTool, toolSchemas, type ToolSchema } from '../tools/index';
import { isoDate } from '../util/time';

export const ENV_VERSION = 1;
export const MAX_STEPS = 30;
/** episodes.seed is a Postgres int4. */
export const MAX_SEED = 2_147_483_647;
const ANON_TTL_MS = 3_600_000;
const OWNED_TTL_MS = 7 * 86_400_000;
const TX = { timeout: 20_000 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ResetRequest { task: string; seed: number; owner?: string }
export interface ResetResult {
  episode_id: string;
  task: { slug: string; title: string; prompt: string };
  seed: number;
  store_date: string;
  max_steps: number;
  tools: ToolSchema[];
}
export interface StepRequest { tool: string; args?: unknown }
export interface StepResult { step: number; ok: boolean; result?: unknown; error?: string; done: boolean; score?: ScoreResult }
export interface EpisodeInfo {
  episode_id: string; task_slug: string; seed: number; status: string; steps: number;
  store_date: string; expires_at: string; score: ScoreResult | null;
}
export interface EnvOptions { tasks?: AnyTask[]; now?: () => Date }
export interface Env {
  reset(req: ResetRequest): Promise<ResetResult>;
  step(episodeId: string, req: StepRequest): Promise<StepResult>;
  score(episodeId: string): Promise<ScoreResult>;
  getEpisode(episodeId: string): Promise<EpisodeInfo>;
  expireEpisodes(limit?: number): Promise<number>;
}

/** Thrown inside the step transaction to roll it back; caught outside to log the failed step. */
class StepFailed extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

const digest = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 16);

function assertUuid(id: string): string {
  if (!UUID_RE.test(id)) throw new EnvError('not_found', `episode ${id} not found`);
  return id;
}

export function createEnv(db: ShopDb, options: EnvOptions = {}): Env {
  const tasks = options.tasks ?? TASKS;
  const now = options.now ?? (() => new Date());

  const findTask = (slug: string): AnyTask => {
    const task = tasks.find((t) => t.slug === slug);
    if (!task) throw new EnvError('unknown_task', `unknown task "${slug}"`);
    return task;
  };

  /** Runs DB work; anything that is not one of our own errors becomes an InfraError. */
  async function infra<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof EnvError || e instanceof InfraError || e instanceof StepFailed) throw e;
      throw new InfraError(`database error: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
  }

  async function lockEpisode(tx: Tx, id: string) {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "backoffice_gym"."episodes" WHERE id = $1::uuid FOR UPDATE', id);
    if (rows.length === 0) throw new EnvError('not_found', `episode ${id} not found`);
    return tx.episode.findUniqueOrThrow({ where: { id } });
  }
  type LockedEpisode = Awaited<ReturnType<typeof lockEpisode>>;

  const stepCount = (tx: Tx, id: string) => tx.actionLog.count({ where: { episode_id: id } });

  /** Scores and closes the episode. The caller's transaction must hold the episode lock. Idempotent. */
  async function scoreLocked(tx: Tx, ep: LockedEpisode): Promise<ScoreResult> {
    if (ep.score) return ep.score as unknown as ScoreResult;
    const template = findTask(ep.task_slug);
    const initial = ep.initial_state as unknown as Dump;
    const final = await dumpEpisode(tx, ep.id);
    const result = scoreTask(template, { expected: ep.expected, initial, final, diff: diffDumps(initial, final), storeDate: isoDate(ep.store_date) });
    await tx.episode.update({ where: { id: ep.id }, data: { status: 'scored', score: toJson(result) } });
    return result;
  }

  /** The result for a step that cannot run (finished, expired or at the cap), or null when the episode is open. */
  async function closedResult(tx: Tx, ep: LockedEpisode): Promise<StepResult | null> {
    const count = await stepCount(tx, ep.id);
    const existing = (ep.score as unknown as ScoreResult | null) ?? null;
    if (ep.status !== 'active') return { step: count, ok: false, error: 'the episode is finished', done: true, ...(existing ? { score: existing } : {}) };
    if (ep.expires_at <= now()) return { step: count, ok: false, error: 'the episode has expired', done: true, ...(existing ? { score: existing } : {}) };
    if (count >= MAX_STEPS) return { step: count, ok: false, error: 'step limit reached', done: true, score: await scoreLocked(tx, ep) };
    return null;
  }

  async function expireEpisodes(limit = 100): Promise<number> {
    return infra(() =>
      db.$executeRawUnsafe(
        'DELETE FROM "backoffice_gym"."episodes" WHERE id IN (SELECT id FROM "backoffice_gym"."episodes" WHERE expires_at < $1 ORDER BY expires_at LIMIT $2)',
        now(),
        limit,
      ),
    );
  }

  async function reset({ task, seed, owner = 'system' }: ResetRequest): Promise<ResetResult> {
    const template = findTask(task);
    if (!Number.isSafeInteger(seed) || seed < 0 || seed > MAX_SEED) throw new EnvError('bad_seed', `seed must be an integer from 0 to ${MAX_SEED}`);
    const instance = template.generate(seed);
    await expireEpisodes(50);
    const id = randomUUID();
    const created = now();
    const ttl = owner === 'anon' ? ANON_TTL_MS : OWNED_TTL_MS;
    await infra(() =>
      db.$transaction(async (tx) => {
        await tx.episode.create({
          data: {
            id, task_slug: template.slug, seed, env_version: ENV_VERSION, store_date: instance.storeDate, status: 'active', owner,
            created_at: created, expires_at: new Date(created.getTime() + ttl), initial_state_hash: '', initial_state: {}, expected: toJson(instance.expected),
          },
        });
        await insertRows(tx, id, instance.rows);
        const initial = await dumpEpisode(tx, id);
        await tx.episode.update({ where: { id }, data: { initial_state: toJson(initial), initial_state_hash: hashDump(initial) } });
      }, TX),
    );
    return {
      episode_id: id, task: { slug: template.slug, title: template.title, prompt: instance.prompt }, seed,
      store_date: isoDate(instance.storeDate), max_steps: MAX_STEPS, tools: toolSchemas(),
    };
  }

  async function score(episodeId: string): Promise<ScoreResult> {
    assertUuid(episodeId);
    return infra(() => db.$transaction(async (tx) => scoreLocked(tx, await lockEpisode(tx, episodeId)), TX));
  }

  async function step(episodeId: string, req: StepRequest): Promise<StepResult> {
    assertUuid(episodeId);
    try {
      return await infra(() =>
        db.$transaction(async (tx): Promise<StepResult> => {
          const ep = await lockEpisode(tx, episodeId);
          const closed = await closedResult(tx, ep);
          if (closed) return closed;
          const n = (await stepCount(tx, episodeId)) + 1;
          try {
            const tool = getTool(req.tool);
            if (!tool) throw new ToolError(`unknown tool "${req.tool}"`);
            const parsed = tool.input.safeParse(req.args ?? {});
            if (!parsed.success) throw new ToolError(`invalid arguments for ${tool.name}: ${z.prettifyError(parsed.error)}`);
            const result = await tool.run({ tx, episodeId, step: n, storeDate: ep.store_date }, parsed.data);
            await tx.actionLog.create({ data: { episode_id: episodeId, id: n, tool: req.tool, args: toJson(req.args ?? {}), ok: true, result_digest: digest(result) } });
            if (tool.kind === 'end') {
              await tx.episode.update({ where: { id: episodeId }, data: { summary: String((parsed.data as { summary?: unknown }).summary ?? '') } });
            }
            // Submit and the step cap close the episode in this same transaction, so no queued step can slip in.
            const done = tool.kind === 'end' || n >= MAX_STEPS;
            return { step: n, ok: true, result, done, ...(done ? { score: await scoreLocked(tx, ep) } : {}) };
          } catch (e) {
            const message = e instanceof ToolError ? e.message : constraintMessage(e);
            if (message === null) throw e;
            throw new StepFailed(message);
          }
        }, TX),
      );
    } catch (e) {
      if (!(e instanceof StepFailed)) throw e;
      // The failed step's writes were rolled back; log it in a fresh transaction, re-checking that the episode is still open.
      return infra(() =>
        db.$transaction(async (tx): Promise<StepResult> => {
          const ep = await lockEpisode(tx, episodeId);
          const closed = await closedResult(tx, ep);
          if (closed) return closed;
          const n = (await stepCount(tx, episodeId)) + 1;
          await tx.actionLog.create({ data: { episode_id: episodeId, id: n, tool: req.tool, args: toJson(req.args ?? {}), ok: false, error: e.reason } });
          const done = n >= MAX_STEPS;
          return { step: n, ok: false, error: e.reason, done, ...(done ? { score: await scoreLocked(tx, ep) } : {}) };
        }, TX),
      );
    }
  }

  async function getEpisode(episodeId: string): Promise<EpisodeInfo> {
    assertUuid(episodeId);
    return infra(async () => {
      const ep = await db.episode.findUnique({ where: { id: episodeId } });
      if (!ep) throw new EnvError('not_found', `episode ${episodeId} not found`);
      const steps = await db.actionLog.count({ where: { episode_id: episodeId } });
      return {
        episode_id: ep.id, task_slug: ep.task_slug, seed: ep.seed, status: ep.status, steps, store_date: isoDate(ep.store_date),
        expires_at: ep.expires_at.toISOString(), score: (ep.score as unknown as ScoreResult | null) ?? null,
      };
    });
  }

  return { reset, step, score, getEpisode, expireEpisodes };
}
