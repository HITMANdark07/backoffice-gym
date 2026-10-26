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

/**
 * Supabase's CA certificate (PEM) from BACKOFFICE_GYM_DB_CA_CERT. When set, the runtime verifies the
 * database's certificate instead of only encrypting. Literal "\n" escapes are accepted.
 */
export const dbCaCert = (env: Record<string, string | undefined> = process.env): string | undefined => {
  const pem = env.BACKOFFICE_GYM_DB_CA_CERT?.replaceAll('\\n', '\n').trim();
  if (!pem) return undefined;
  if (!pem.includes('-----BEGIN CERTIFICATE-----')) {
    throw new Error('BACKOFFICE_GYM_DB_CA_CERT must be the certificate file contents, starting with -----BEGIN CERTIFICATE-----');
  }
  return pem;
};
