import { testDatabaseUrl } from '@backoffice-gym/db';
import { beforeAll, describe, expect, it } from 'vitest';

let GET: (req: Request) => Promise<Response>;
let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  process.env.BACKOFFICE_GYM_DATABASE_URL = testDatabaseUrl();
  ({ GET, POST } = (await import('./[...route]/route')) as unknown as { GET: typeof GET; POST: typeof POST });
});

describe('/api under Next', () => {
  it('serves the RL API', async () => {
    const tasks = await GET(new Request('http://local/api/tasks'));
    expect(tasks.status).toBe(200);
    expect(((await tasks.json()) as { tasks: unknown[] }).tasks).toHaveLength(8);
    const reset = await POST(new Request('http://local/api/episodes', { method: 'POST', body: JSON.stringify({ task: 'callback', seed: 1 }) }));
    expect(reset.status).toBe(201);
  });
});
