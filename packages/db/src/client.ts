import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from './generated/prisma/client';

export type ShopDb = PrismaClient;
export type Tx = Prisma.TransactionClient;

/** Prisma client for a BackOffice Gym database, on the node-postgres driver adapter. */
export function createDb(url: string, opts: { max?: number } = {}): ShopDb {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, ...(opts.max ? { max: opts.max } : {}) }) });
}
