import type { ShopDb } from '@shopgym/db';
import { getTool } from '../tools/index';

/** Runs one tool directly in a transaction (bypasses the lifecycle). Throws the tool's errors. */
export async function runTool(db: ShopDb, episodeId: string, storeDate: Date, name: string, args: unknown, step = 1): Promise<any> {
  const tool = getTool(name);
  if (!tool) throw new Error(`no tool ${name}`);
  const parsed = tool.input.parse(args);
  return db.$transaction((tx) => tool.run({ tx, episodeId, step, storeDate }, parsed));
}
