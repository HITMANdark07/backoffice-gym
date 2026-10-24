import { createDb, devDatabaseUrl, poolMax, type ShopDb } from '@backoffice-gym/db';
import { buildApi } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One Prisma client per server process (survives dev hot reloads).
const g = globalThis as unknown as { __backofficeGymDb?: ShopDb };
const db = (g.__backofficeGymDb ??= createDb(devDatabaseUrl(), { max: poolMax() }));

const app = buildApi(db);

export const GET = (req: Request): Response | Promise<Response> => app.fetch(req);
export const POST = (req: Request): Response | Promise<Response> => app.fetch(req);
