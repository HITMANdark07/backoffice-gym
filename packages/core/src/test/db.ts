import { randomUUID } from 'node:crypto';
import { createDb, testDatabaseUrl, type ShopDb } from '@shopgym/db';
import { insertRows } from '../store/insert';
import type { StoreRows } from '../store/types';

export const testDb = (): ShopDb => createDb(testDatabaseUrl());

/** Inserts `rows` as a new episode without the lifecycle (for tool tests). Returns the episode id. */
export async function seedEpisode(db: ShopDb, rows: StoreRows, storeDate: Date): Promise<string> {
  const id = randomUUID();
  await db.$transaction(async (tx) => {
    await tx.episode.create({
      data: {
        id, task_slug: 'test', seed: 0, env_version: 0, store_date: storeDate, owner: 'system', created_at: new Date(),
        expires_at: new Date(Date.now() + 3_600_000), initial_state_hash: '', initial_state: {}, expected: {},
      },
    });
    await insertRows(tx, id, rows);
  }, { timeout: 20_000 });
  return id;
}
