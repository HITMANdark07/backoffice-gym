import type { Prisma } from './generated/prisma/client';

/** Removes NUL characters, which Postgres jsonb cannot store, from every string and key. */
function stripNul(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/\u0000/g, '');
  if (Array.isArray(value)) return value.map(stripNul);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k.replace(/\u0000/g, ''), stripNul(v)]));
  }
  return value;
}

/** Plain JSON copy (drops undefined, turns Dates into ISO strings, strips NUL) typed for Prisma Json columns. */
export function toJson(value: unknown): Prisma.InputJsonValue {
  return stripNul(JSON.parse(JSON.stringify(value ?? null))) as Prisma.InputJsonValue;
}
