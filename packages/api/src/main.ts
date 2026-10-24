import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import { createEnv } from '@backoffice-gym/core';
import { createDb, devDatabaseUrl } from '@backoffice-gym/db';
import { createApi } from './app';

// Local RL server: localhost only, no auth, no rate limits (spec §6). The cloud deployment adds the limiter.
const db = createDb(devDatabaseUrl());
const app = createApi({ env: createEnv(db), owner: 'system', clientIp: (c) => getConnInfo(c).remote.address ?? 'unknown' });
const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`BackOffice Gym API on http://127.0.0.1:${info.port}/api`);
});
