const user = (): string => process.env.USER ?? 'postgres';

export const devDatabaseUrl = (): string =>
  process.env.BACKOFFICE_GYM_DATABASE_URL ?? `postgresql://${user()}@localhost:5432/backoffice_gym_dev`;

export const testDatabaseUrl = (): string =>
  process.env.BACKOFFICE_GYM_TEST_DATABASE_URL ?? `postgresql://${user()}@localhost:5432/backoffice_gym_test`;

/** Connections per server process, from BACKOFFICE_GYM_DB_POOL_MAX (keep it small on serverless). Undefined → driver default. */
export const poolMax = (env: Record<string, string | undefined> = process.env): number | undefined => {
  const n = Number(env.BACKOFFICE_GYM_DB_POOL_MAX);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};
