import { InfraError } from '@shopgym/core';
import type { ShopDb } from '@shopgym/db';
import type { LimitBucket, RateLimiter } from './app';

export interface LimitRule {
  max: number;
  windowMs: number;
}

/** Spec §6: 30 episodes and 600 steps per IP per hour. */
export const DEFAULT_LIMITS: Record<LimitBucket, LimitRule> = {
  episodes: { max: 30, windowMs: 3_600_000 },
  steps: { max: 600, windowMs: 3_600_000 },
};

/** Fixed-window counters in shopgym.rate_limits, one upsert per hit. */
export function createPgRateLimiter(
  db: ShopDb,
  limits: Record<LimitBucket, LimitRule> = DEFAULT_LIMITS,
  now: () => Date = () => new Date(),
): RateLimiter & { prune(olderThanMs?: number): Promise<number> } {
  return {
    async hit(key, bucket) {
      const rule = limits[bucket];
      const t = now().getTime();
      const start = new Date(Math.floor(t / rule.windowMs) * rule.windowMs);
      try {
        const rows = await db.$queryRawUnsafe<Array<{ count: number }>>(
          `INSERT INTO "shopgym"."rate_limits" (key, bucket, window_start, count) VALUES ($1, $2, $3, 1)
           ON CONFLICT (key, bucket, window_start) DO UPDATE SET count = "rate_limits".count + 1
           RETURNING count`,
          key,
          bucket,
          start,
        );
        const count = Number(rows[0]?.count ?? 0);
        return { ok: count <= rule.max, retryAfterS: Math.ceil((start.getTime() + rule.windowMs - t) / 1000) };
      } catch (e) {
        throw new InfraError(`rate limiter: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
      }
    },
    async prune(olderThanMs = 86_400_000) {
      return db.$executeRawUnsafe('DELETE FROM "shopgym"."rate_limits" WHERE window_start < $1', new Date(now().getTime() - olderThanMs));
    },
  };
}
