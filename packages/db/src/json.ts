import type { Prisma } from './generated/prisma/client';

/** Plain JSON copy (drops undefined, turns Dates into ISO strings) typed for Prisma Json columns. */
export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
