const user = (): string => process.env.USER ?? 'postgres';

export const devDatabaseUrl = (): string =>
  process.env.SHOPGYM_DATABASE_URL ?? `postgresql://${user()}@localhost:5432/shopgym_dev`;

export const testDatabaseUrl = (): string =>
  process.env.SHOPGYM_TEST_DATABASE_URL ?? `postgresql://${user()}@localhost:5432/shopgym_test`;
