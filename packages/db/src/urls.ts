const user = (): string => process.env.USER ?? 'postgres';

export const devDatabaseUrl = (): string =>
  process.env.BACKOFFICE_GYM_DATABASE_URL ?? `postgresql://${user()}@localhost:5432/backoffice_gym_dev`;

export const testDatabaseUrl = (): string =>
  process.env.BACKOFFICE_GYM_TEST_DATABASE_URL ?? `postgresql://${user()}@localhost:5432/backoffice_gym_test`;
