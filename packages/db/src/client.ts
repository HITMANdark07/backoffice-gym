import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from './generated/prisma/client';

export type ShopDb = PrismaClient;
export type Tx = Prisma.TransactionClient;

/** node-postgres pool settings, as the Prisma adapter accepts them. */
export type PoolConfig = Extract<ConstructorParameters<typeof PrismaPg>[0], { connectionString?: string }>;

export interface DbOptions {
  /** Pool size; serverless functions keep it small. */
  max?: number;
  /** CA certificate (PEM). When set, the server certificate is verified against it. */
  ca?: string;
}

const SSL_PARAMS = ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat'];

/**
 * node-postgres settings. URL parameters override the ssl option, so with a CA the libpq ssl
 * parameters are dropped from the URL and verification comes from the ssl option alone.
 */
export function pgPoolConfig(url: string, opts: DbOptions = {}): PoolConfig {
  const max = opts.max ? { max: opts.max } : {};
  if (!opts.ca) return { connectionString: url, ...max };
  const u = new URL(url);
  for (const p of SSL_PARAMS) u.searchParams.delete(p);
  return { connectionString: u.toString(), ssl: { ca: opts.ca, rejectUnauthorized: true }, ...max };
}

/** Prisma client for a BackOffice Gym database, on the node-postgres driver adapter. */
export function createDb(url: string, opts: DbOptions = {}): ShopDb {
  return new PrismaClient({ adapter: new PrismaPg(pgPoolConfig(url, opts)) });
}
