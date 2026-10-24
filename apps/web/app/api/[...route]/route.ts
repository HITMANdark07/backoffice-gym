import { createApi } from '@backoffice-gym/api';
import { createEnv } from '@backoffice-gym/core';
import { createDb, devDatabaseUrl, type ShopDb } from '@backoffice-gym/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// One Prisma client per server process (survives dev hot reloads).
const g = globalThis as unknown as { __backofficeGymDb?: ShopDb };
const db = (g.__backofficeGymDb ??= createDb(devDatabaseUrl()));

// Visitors' episodes are anonymous and expire after an hour. Rate limiting is switched on by the deployment (M5).
const app = createApi({ env: createEnv(db), owner: 'anon' });

export const GET = (req: Request): Response | Promise<Response> => app.fetch(req);
export const POST = (req: Request): Response | Promise<Response> => app.fetch(req);
