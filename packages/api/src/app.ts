import { randomInt } from 'node:crypto';
import { EnvError, GENERIC_CHECKS, InfraError, MAX_SEED, TASKS, type Env } from '@backoffice-gym/core';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';

export type LimitBucket = 'episodes' | 'steps';

export interface RateLimiter {
  hit(key: string, bucket: LimitBucket): Promise<{ ok: boolean; retryAfterS: number }>;
}

export interface ApiOptions {
  env: Env;
  /** Owner recorded on new episodes; 'anon' episodes expire after an hour. */
  owner?: string;
  /** Off locally; the cloud deployment turns it on. */
  limiter?: RateLimiter;
  /** The client's address for rate limiting. */
  clientIp?: (c: Context) => string;
  /** Extra cleanup for GET /api/health. */
  onHealth?: () => Promise<void>;
}

class HttpError extends Error {
  constructor(
    readonly status: 400 | 404 | 413 | 429,
    message: string,
    readonly retryAfterS?: number,
  ) {
    super(message);
  }
}

async function readJson(c: Context): Promise<Record<string, unknown>> {
  const raw = await c.req.text();
  if (raw.trim() === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'the body must be JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new HttpError(400, 'the body must be a JSON object');
  return parsed as Record<string, unknown>;
}

export function createApi(o: ApiOptions): Hono {
  const app = new Hono().basePath('/api');
  const owner = o.owner ?? 'anon';
  const ipOf = o.clientIp ?? (() => 'local');

  const limit = async (c: Context, bucket: LimitBucket) => {
    if (!o.limiter) return;
    const r = await o.limiter.hit(ipOf(c), bucket);
    if (!r.ok) throw new HttpError(429, `too many ${bucket}; try again later`, r.retryAfterS);
  };

  app.use('*', bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: 'the body is larger than 64 KB' }, 413) }));

  app.onError((e, c) => {
    if (e instanceof HttpError) {
      if (e.retryAfterS !== undefined) c.header('retry-after', String(e.retryAfterS));
      return c.json({ error: e.message }, e.status);
    }
    if (e instanceof EnvError) return c.json({ error: e.message, code: e.code }, e.code === 'not_found' ? 404 : 400);
    if (e instanceof InfraError) return c.json({ error: 'the environment is temporarily unavailable' }, 503);
    return c.json({ error: 'internal error' }, 500);
  });

  app.get('/tasks', (c) =>
    c.json({
      tasks: TASKS.map((t) => ({
        slug: t.slug,
        title: t.title,
        summary: t.summary,
        checks: [
          ...t.checks.map((ch) => ({ id: ch.id, kind: ch.kind, weight: ch.kind === 'required' ? (ch.weight ?? 1) : 0, description: ch.description })),
          ...GENERIC_CHECKS.map((g) => ({ id: g.id, kind: g.kind, weight: 0, description: g.description })),
        ],
      })),
    }),
  );

  app.post('/episodes', async (c) => {
    const body = await readJson(c);
    if (typeof body.task !== 'string') throw new HttpError(400, 'task is required');
    if (body.seed !== undefined && typeof body.seed !== 'number') throw new HttpError(400, 'seed must be an integer');
    await limit(c, 'episodes');
    const seed = typeof body.seed === 'number' ? body.seed : randomInt(0, MAX_SEED);
    return c.json(await o.env.reset({ task: body.task, seed, owner }), 201);
  });

  app.post('/episodes/:id/step', async (c) => {
    const body = await readJson(c);
    if (typeof body.tool !== 'string') throw new HttpError(400, 'tool is required');
    await limit(c, 'steps');
    return c.json(await o.env.step(c.req.param('id'), { tool: body.tool, args: body.args }));
  });

  app.post('/episodes/:id/score', async (c) => c.json(await o.env.score(c.req.param('id'))));
  app.get('/episodes/:id', async (c) => c.json(await o.env.getEpisode(c.req.param('id'))));

  app.get('/health', async (c) => {
    const expired = await o.env.expireEpisodes(100);
    await o.onHealth?.();
    return c.json({ ok: true, expired_episodes: expired });
  });

  app.notFound((c) => c.json({ error: 'not found' }, 404));
  return app;
}
