import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError } from '@modelcontextprotocol/sdk/types.js';
import { ENV_VERSION, getTool, InfraError, toolSchemas, type Env } from '@shopgym/core';

/** Harness-only tool returning the episode score. mcp-evals hides it from agents (server `hidden_tools`). */
export const SCORE_TOOL = '__score';

export interface ShopGymServerOptions {
  env: Env;
  task: string;
  seed: number;
  /** Called when the database fails. The stdio entry exits so the harness retries; it never becomes a tool result. */
  onInfraError?: (e: InfraError) => void;
}

export interface ShopGymServer {
  server: Server;
  episodeId: string;
  prompt: string;
}

const text = (t: string, isError = false) => ({ content: [{ type: 'text' as const, text: t }], ...(isError ? { isError: true } : {}) });

/**
 * One MCP session = one episode. The low-level Server is used on purpose: arguments go to the environment unvalidated,
 * so invalid arguments are the environment's tool errors and count as steps, exactly as over the RL API.
 */
export async function createShopGymServer(o: ShopGymServerOptions): Promise<ShopGymServer> {
  const reset = await o.env.reset({ task: o.task, seed: o.seed });
  const episodeId = reset.episode_id;
  const server = new Server({ name: 'shopgym', version: `env-${ENV_VERSION}` }, { capabilities: { tools: {} }, instructions: reset.task.prompt });
  const tools = [
    ...toolSchemas().map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema as { type: 'object'; [k: string]: unknown } })),
    {
      name: SCORE_TOOL,
      description: 'Harness only: returns the episode score. Not part of the environment.',
      inputSchema: { type: 'object' as const, properties: {}, additionalProperties: false },
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name;
    try {
      if (name === SCORE_TOOL) return text(JSON.stringify(await o.env.score(episodeId)));
      const r = await o.env.step(episodeId, { tool: name, args: req.params.arguments ?? {} });
      if (!r.ok) return text(r.error ?? 'error', true);
      const capped = r.done && getTool(name)?.kind !== 'end';
      return text(JSON.stringify(r.result) + (capped ? '\nThe step limit was reached; the episode is over.' : ''));
    } catch (e) {
      if (e instanceof InfraError) {
        o.onInfraError?.(e);
        throw new McpError(ErrorCode.InternalError, `environment unavailable: ${e.message}`);
      }
      throw e;
    }
  });

  return { server, episodeId, prompt: reset.task.prompt };
}
