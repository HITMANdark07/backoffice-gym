import { createDb, testDatabaseUrl } from '@shopgym/db';

export async function setup(): Promise<void> {
  const db = createDb(testDatabaseUrl());
  try {
    await db.$executeRawUnsafe('TRUNCATE "shopgym"."episodes" CASCADE');
  } finally {
    await db.$disconnect();
  }
}
