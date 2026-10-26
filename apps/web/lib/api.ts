import { clientIpFromHeaders, createApi, createPgRateLimiter, rateLimitKey } from '@backoffice-gym/api';
import { createEnv, InfraError } from '@backoffice-gym/core';
import type { ShopDb } from '@backoffice-gym/db';

/**
 * The public RL API behind /api. Visitors' episodes are anonymous and expire after an hour.
 * The cloud deployment sets BACKOFFICE_GYM_RATE_LIMIT=on for per-address limits (spec §6), and
 * CRON_SECRET, which Vercel's cron sends to /api/cron/cleanup as a bearer token.
 */
export function buildApi(db: ShopDb, env: Record<string, string | undefined> = process.env) {
  const limiter = env.BACKOFFICE_GYM_RATE_LIMIT === 'on' ? createPgRateLimiter(db) : undefined;
  return createApi({
    env: createEnv(db),
    owner: 'anon',
    limiter,
    clientIp: (c) => rateLimitKey(clientIpFromHeaders((name) => c.req.header(name))),
    health: async () => {
      try {
        await db.$queryRaw`SELECT 1`;
      } catch (e) {
        throw new InfraError(`health: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
      }
    },
    cronSecret: env.CRON_SECRET,
    onCleanup: limiter
      ? async () => {
          await limiter.prune();
        }
      : undefined,
  });
}
