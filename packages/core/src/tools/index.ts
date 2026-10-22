import { z } from 'zod';
import { ACT_TOOLS } from './act';
import { READ_TOOLS } from './read';
import type { ToolDef, ToolSchema } from './types';

export const TOOLS: ToolDef[] = [...READ_TOOLS, ...ACT_TOOLS];

export const getTool = (name: string): ToolDef | undefined => TOOLS.find((t) => t.name === name);

/** Tool descriptions with input JSON Schemas, as an agent (or an MCP client) sees them. */
export function toolSchemas(): ToolSchema[] {
  return TOOLS.map((t) => {
    const schema = z.toJSONSchema(t.input, { io: 'input' }) as Record<string, unknown>;
    delete schema.$schema;
    return { name: t.name, description: t.description, kind: t.kind, input_schema: schema };
  });
}

export type { ToolContext, ToolDef, ToolSchema } from './types';
