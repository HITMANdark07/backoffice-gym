import { clientIpFromHeaders, createApi, createPgRateLimiter } from '@backoffice-gym/api';
import { createEnv } from '@backoffice-gym/core';
import type { ShopDb } from '@backoffice-gym/db';

/**
 * The public RL API behind /api. Visitors' episodes are anonymous and expire after an hour.
 * The cloud deployment sets BACKOFFICE_GYM_RATE_LIMIT=on for per-address limits (spec §6).
 */
export function buildApi(db: ShopDb, env: Record<string, string | undefined> = process.env) {
  const limiter = env.BACKOFFICE_GYM_RATE_LIMIT === 'on' ? createPgRateLimiter(db) : undefined;
  return createApi({
    env: createEnv(db),
    owner: 'anon',
    limiter,
    clientIp: (c) => clientIpFromHeaders((name) => c.req.header(name)),
    onHealth: limiter
      ? async () => {
          await limiter.prune();
        }
      : undefined,
  });
}
