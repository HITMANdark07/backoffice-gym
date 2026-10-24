import type { Tx } from '@backoffice-gym/db';
import type { z } from 'zod';

export interface ToolContext {
  tx: Tx;
  episodeId: string;
  /** This call's step number (1-based). Written to rows the tool creates. */
  step: number;
  storeDate: Date;
}

export interface ToolDef<S extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  kind: 'read' | 'act' | 'end';
  input: S;
  run(ctx: ToolContext, args: z.output<S>): Promise<unknown>;
}

export interface ToolSchema {
  name: string;
  description: string;
  kind: ToolDef['kind'];
  input_schema: Record<string, unknown>;
}

export const defineTool = <S extends z.ZodType>(def: ToolDef<S>): ToolDef<S> => def;
