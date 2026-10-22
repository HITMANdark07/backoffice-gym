import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { testDatabaseUrl } from '@shopgym/db';
import { describe, expect, it } from 'vitest';

const BIN = fileURLToPath(new URL('../bin/shopgym-mcp.mjs', import.meta.url));
const env = { ...getDefaultEnvironment(), SHOPGYM_DATABASE_URL: testDatabaseUrl() };

describe('shopgym-mcp over stdio', () => {
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
    expect((usage as { stderr: string }).stderr).toMatch(/usage: shopgym-mcp/);
    const unknown = await run(process.execPath, [BIN, '--task', 'nope', '--seed', '1'], { env }).catch((e: { code: number; stderr: string }) => e);
    expect(unknown).toMatchObject({ code: 1 });
    expect((unknown as { stderr: string }).stderr).toMatch(/unknown task "nope"/);
  }, 60_000);
});
