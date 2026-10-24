import { createDb, testDatabaseUrl } from '@backoffice-gym/db';

export async function setup(): Promise<void> {
  const db = createDb(testDatabaseUrl());
  try {
    await db.$executeRawUnsafe('TRUNCATE "backoffice_gym"."episodes" CASCADE');
  } finally {
    await db.$disconnect();
  }
}
