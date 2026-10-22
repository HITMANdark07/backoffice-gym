import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from './generated/prisma/client';

export type ShopDb = PrismaClient;
export type Tx = Prisma.TransactionClient;

/** Prisma client for a ShopGym database, on the node-postgres driver adapter. */
export function createDb(url: string): ShopDb {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}
