import { dumpEpisode, TABLES } from '@backoffice-gym/db';
import { afterAll, describe, expect, it } from 'vitest';
import { seedEpisode, testDb } from '../test/db';
import { generateBaseStore } from './generate';

const db = testDb();
afterAll(() => db.$disconnect());

describe('insertRows', () => {
  it('writes every generated row, and the same rows again into a second episode', async () => {
    const { rows, storeDate } = generateBaseStore('insert', 3);
    const a = await seedEpisode(db, rows, storeDate);
    const b = await seedEpisode(db, rows, storeDate);
    const dumpA = await dumpEpisode(db, a);
    const dumpB = await dumpEpisode(db, b);
    for (const table of TABLES) expect(dumpA[table], table).toHaveLength(rows[table].length);
    expect(dumpA).toEqual(dumpB);
    expect(dumpA.orders[0]?.placed_on).toBe(rows.orders[0]?.placed_on.toISOString());
  });
});
