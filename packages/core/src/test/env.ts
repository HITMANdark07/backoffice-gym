import type { ShopDb } from '@backoffice-gym/db';
import type { Env, StepResult } from '../episode/env';
import type { TaskTemplate } from '../tasks/types';

/** The hidden expected outcome of an episode. Tests only; never exposed by any API. */
export async function expectedOf<E>(db: ShopDb, episodeId: string): Promise<E> {
  const ep = await db.episode.findUniqueOrThrow({ where: { id: episodeId } });
  return ep.expected as E;
}

/** The first seed (from 1) whose generated instance satisfies `pred`. Deterministic. */
export function findSeed<E>(task: TaskTemplate<E>, pred: (e: E) => boolean, max = 500): number {
  for (let seed = 1; seed <= max; seed++) if (pred(task.generate(seed).expected)) return seed;
  throw new Error(`no seed in 1..${max} matches for ${task.slug}`);
}

export async function play(env: Env, episodeId: string, calls: Array<[string, unknown]>): Promise<StepResult[]> {
  const results: StepResult[] = [];
  for (const [tool, args] of calls) results.push(await env.step(episodeId, { tool, args }));
  return results;
}
