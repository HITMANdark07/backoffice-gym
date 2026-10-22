import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createEnv } from '@shopgym/core';
import { createDb, devDatabaseUrl } from '@shopgym/db';
import { parseArgs, USAGE, UsageError, type CliArgs } from './args';
import { createShopGymServer } from './server';

const fail = (message: string, code: number): never => {
  process.stderr.write(`shopgym-mcp: ${message}\n`);
  process.exit(code);
};

/** Entry for bin/shopgym-mcp.mjs. Never writes to stdout: stdout is the MCP channel. */
export async function run(argv: string[]): Promise<void> {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (e) {
    return fail(e instanceof UsageError ? `${e.message}\n${USAGE}` : String(e), 64);
  }
  const db = createDb(args.databaseUrl ?? devDatabaseUrl());
  try {
    const { server } = await createShopGymServer({
      env: createEnv(db),
      task: args.task,
      seed: args.seed,
      // Exiting closes the connection: mcp-evals sees a crashed server (retryable), never a tool error.
      onInfraError: (e) => fail(e.message, 70),
    });
    server.onclose = () => {
      void db.$disconnect();
    };
    await server.connect(new StdioServerTransport());
  } catch (e) {
    await db.$disconnect().catch(() => {});
    fail(e instanceof Error ? e.message : String(e), 1);
  }
}
