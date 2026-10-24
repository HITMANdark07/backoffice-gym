import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { testDatabaseUrl } from '@backoffice-gym/db';
import { describe, expect, it } from 'vitest';

const BIN = fileURLToPath(new URL('../bin/backoffice-gym-mcp.mjs', import.meta.url));
const env = { ...getDefaultEnvironment(), BACKOFFICE_GYM_DATABASE_URL: testDatabaseUrl() };

describe('backoffice-gym-mcp over stdio', () => {
  it('serves an episode to a real MCP client', async () => {
    const transport = new StdioClientTransport({ command: process.execPath, args: [BIN, '--task', 'damaged-item', '--seed', '1'], env, stderr: 'pipe' });
    const client = new Client({ name: 'stdio-test', version: '0' });
    await client.connect(transport);
    try {
      expect((await client.listTools()).tools).toHaveLength(17);
      expect(client.getInstructions()).toMatch(/Juniper Goods/);
      const r = await client.callTool({ name: 'read_policy', arguments: {} });
      expect((r.content as Array<{ text: string }>)[0]!.text).toMatch(/30 days/);
    } finally {
      await client.close();
    }
  }, 60_000);

  it('exits 64 with usage for bad arguments and 1 for an unknown task', async () => {
    const run = promisify(execFile);
    const usage = await run(process.execPath, [BIN, '--task', 'x'], { env }).catch((e: { code: number; stderr: string }) => e);
    expect(usage).toMatchObject({ code: 64 });
    expect((usage as { stderr: string }).stderr).toMatch(/usage: backoffice-gym-mcp/);
    const unknown = await run(process.execPath, [BIN, '--task', 'nope', '--seed', '1'], { env }).catch((e: { code: number; stderr: string }) => e);
    expect(unknown).toMatchObject({ code: 1 });
    expect((unknown as { stderr: string }).stderr).toMatch(/unknown task "nope"/);
  }, 60_000);
});

describe('backoffice-gym-mcp when the database goes away', () => {
  it('exits 70 so the harness retries, instead of returning a tool error', async () => {
    const { createServer, connect } = await import('node:net');
    const sockets = new Set<import('node:net').Socket>();
    // A TCP proxy in front of Postgres that the test can cut mid-session.
    const proxy = createServer((client) => {
      const upstream = connect(5432, '127.0.0.1');
      sockets.add(client).add(upstream);
      client.pipe(upstream).pipe(client);
      const drop = () => { client.destroy(); upstream.destroy(); };
      client.on('error', drop); upstream.on('error', drop);
    });
    await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', r));
    const port = (proxy.address() as import('node:net').AddressInfo).port;
    const url = testDatabaseUrl().replace('localhost:5432', `127.0.0.1:${port}`);
    const { mkdtempSync, readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const codeFile = join(mkdtempSync(join(tmpdir(), 'backoffice-gym-exit-')), 'code');
    // sh records the server's exit code; the SDK transport does not expose it.
    const script = `"${process.execPath}" "${BIN}" --task damaged-item --seed 1 --database-url "${url}"; echo $? > "${codeFile}"`;
    const transport = new StdioClientTransport({ command: '/bin/sh', args: ['-c', script], env, stderr: 'pipe' });
    let stderr = '';
    transport.stderr?.on('data', (c: Buffer) => { stderr += c.toString(); });
    const exited = new Promise<number | null>((resolve) => { transport.onclose = () => resolve(null); });
    const client = new Client({ name: 'outage-test', version: '0' });
    await client.connect(transport);
    await client.callTool({ name: 'read_policy', arguments: {} });
    await new Promise<void>((r) => proxy.close(() => r()));
    for (const s of sockets) s.destroy();
    await expect(client.callTool({ name: 'read_policy', arguments: {} })).rejects.toThrow(/Connection closed/i);
    await exited;
    expect(stderr).toMatch(/backoffice-gym-mcp: database error/);
    for (let i = 0; i < 50 && !readFileSync(codeFile, { flag: 'a+' }).toString().trim(); i++) await new Promise((r) => setTimeout(r, 100));
    expect(readFileSync(codeFile, 'utf8').trim()).toBe('70');
  }, 60_000);
});
