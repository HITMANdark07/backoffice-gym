import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createEnv, InfraError, type Env } from '@shopgym/core';
import { createDb, testDatabaseUrl } from '@shopgym/db';
import { afterAll, describe, expect, it } from 'vitest';
import { createShopGymServer, SCORE_TOOL } from './server';

const db = createDb(testDatabaseUrl());
const env = createEnv(db);
afterAll(() => db.$disconnect());

async function connect(over: { env?: Env; task?: string; seed?: number; onInfraError?: (e: InfraError) => void } = {}) {
  const sg = await createShopGymServer({ env: over.env ?? env, task: over.task ?? 'refund-window-trap', seed: over.seed ?? 1, ...(over.onInfraError ? { onInfraError: over.onInfraError } : {}) });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await sg.server.connect(serverSide);
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(clientSide);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await client.callTool({ name, arguments: args });
    return { text: (r.content as Array<{ text: string }>)[0]!.text, isError: r.isError === true };
  };
  return { sg, client, call };
}

describe('ShopGym MCP server', () => {
  it('lists the 16 environment tools plus the harness score tool, with the prompt as instructions', async () => {
    const { sg, client } = await connect();
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(17);
    expect(tools.map((t) => t.name)).toContain(SCORE_TOOL);
    expect(tools.find((t) => t.name === 'issue_refund')?.inputSchema).toMatchObject({ type: 'object', required: ['order_id', 'amount', 'reason'] });
    expect(client.getInstructions()).toBe(sg.prompt);
    expect(client.getServerVersion()).toMatchObject({ name: 'shopgym', version: 'env-1' });
  });

  it('runs tools through the environment; invalid arguments are tool errors that count as steps', async () => {
    const { sg, call } = await connect();
    expect(JSON.parse((await call('read_policy')).text).policy).toMatch(/30 days/);
    const bad = await call('issue_refund', { order_id: 'x' });
    expect(bad).toMatchObject({ isError: true });
    expect(bad.text).toMatch(/invalid arguments for issue_refund/);
    expect((await env.getEpisode(sg.episodeId)).steps).toBe(2);
  });

  it('submit reveals nothing; later calls are refused; __score returns the score', async () => {
    const { call } = await connect();
    const inbox = JSON.parse((await call('list_inbox')).text);
    await call('reply_to_thread', { thread_id: inbox.threads[0].thread_id, body: 'Sorry, our policy only allows refunds within 30 days of delivery.' });
    const submitted = await call('submit', { summary: 'declined' });
    expect(submitted).toEqual({ text: '{"submitted":true}', isError: false });
    expect(await call('read_policy')).toMatchObject({ isError: true, text: 'the episode is finished' });
    expect(JSON.parse((await call(SCORE_TOOL)).text)).toMatchObject({ reward: 1, passed: true });
  });

  it('fails at startup for an unknown task', async () => {
    await expect(createShopGymServer({ env, task: 'nope', seed: 1 })).rejects.toMatchObject({ code: 'unknown_task' });
  });

  it('reports infrastructure failures to onInfraError and never as a tool result', async () => {
    const seen: InfraError[] = [];
    const broken: Env = { ...env, step: async () => { throw new InfraError('database down'); } };
    const { call } = await connect({ env: broken, onInfraError: (e) => { seen.push(e); } });
    await expect(call('read_policy')).rejects.toThrow(/environment unavailable/);
    expect(seen.map((e) => e.message)).toEqual(['database down']);
  });
});
