import { describe, expect, it } from 'vitest';
import { pgPoolConfig } from './client';
import { dbCaCert } from './urls';

const PEM = '-----BEGIN CERTIFICATE-----\nMIIDxTCCAq2gAwIBAgIBADANBgkqhkiG9w0BAQsFADB\n-----END CERTIFICATE-----';

describe('dbCaCert', () => {
  it('reads the PEM from BACKOFFICE_GYM_DB_CA_CERT', () => {
    expect(dbCaCert({ BACKOFFICE_GYM_DB_CA_CERT: `  ${PEM}\n` })).toBe(PEM);
  });

  it('turns literal \\n escapes into newlines, for dashboards that keep values on one line', () => {
    expect(dbCaCert({ BACKOFFICE_GYM_DB_CA_CERT: PEM.replaceAll('\n', '\\n') })).toBe(PEM);
  });

  it('is undefined when unset or blank, and rejects a value that is not a PEM certificate', () => {
    expect(dbCaCert({})).toBeUndefined();
    expect(dbCaCert({ BACKOFFICE_GYM_DB_CA_CERT: '   ' })).toBeUndefined();
    expect(() => dbCaCert({ BACKOFFICE_GYM_DB_CA_CERT: 'prod-ca-2021.crt' })).toThrow(/BEGIN CERTIFICATE/);
  });
});

describe('pgPoolConfig', () => {
  const url = 'postgresql://postgres.ref:pw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=no-verify&application_name=gym';

  it('passes the URL through unchanged without a CA', () => {
    expect(pgPoolConfig(url)).toEqual({ connectionString: url });
    expect(pgPoolConfig(url, { max: 3 })).toEqual({ connectionString: url, max: 3 });
  });

  it('verifies the server certificate against the CA, dropping ssl settings from the URL that would override it', () => {
    const cfg = pgPoolConfig(url, { ca: PEM, max: 3 });
    expect(cfg.ssl).toEqual({ ca: PEM, rejectUnauthorized: true });
    expect(cfg.max).toBe(3);
    const parsed = new URL(cfg.connectionString!);
    expect(parsed.searchParams.has('sslmode')).toBe(false);
    expect(parsed.searchParams.get('application_name')).toBe('gym');
    expect(parsed.hostname).toBe('aws-0-ap-south-1.pooler.supabase.com');
    expect(parsed.password).toBe('pw');
  });

  it('removes every libpq ssl parameter', () => {
    const cfg = pgPoolConfig('postgresql://u@h/db?sslmode=require&sslrootcert=x&sslcert=y&sslkey=z&uselibpqcompat=true', { ca: PEM });
    expect(new URL(cfg.connectionString!).search).toBe('');
  });
});
