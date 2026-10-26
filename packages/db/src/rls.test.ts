import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createDb } from './client';
import { testDatabaseUrl } from './urls';

const db = createDb(testDatabaseUrl());
afterAll(() => db.$disconnect());

class Rollback extends Error {}

describe('row-level security', () => {
  it('is enabled on every BackOffice Gym table', async () => {
    const rows = await db.$queryRawUnsafe<Array<{ relname: string; relrowsecurity: boolean }>>(
      `SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'backoffice_gym' AND c.relkind = 'r' ORDER BY 1`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(18);
    expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
  });

  it('hides rows from a role that does not own the tables, while the owner still sees them', async () => {
    const key = `rls-${randomUUID()}`;
    let ownerSees = -1;
    let otherSees = -1;
    await db
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`INSERT INTO "backoffice_gym"."rate_limits" (key, bucket, window_start, count) VALUES ($1, 'steps', now(), 1)`, key);
        ownerSees = Number((await tx.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM "backoffice_gym"."rate_limits" WHERE key = $1`, key))[0]!.n);
        await tx.$executeRawUnsafe('CREATE ROLE backoffice_gym_rls_probe');
        await tx.$executeRawUnsafe('GRANT USAGE ON SCHEMA "backoffice_gym" TO backoffice_gym_rls_probe');
        await tx.$executeRawUnsafe('GRANT SELECT ON "backoffice_gym"."rate_limits" TO backoffice_gym_rls_probe');
        await tx.$executeRawUnsafe('SET LOCAL ROLE backoffice_gym_rls_probe');
        otherSees = Number((await tx.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM "backoffice_gym"."rate_limits" WHERE key = $1`, key))[0]!.n);
        throw new Rollback();
      })
      .catch((e) => {
        if (!(e instanceof Rollback)) throw e;
      });
    expect(ownerSees).toBe(1);
    expect(otherSees).toBe(0);
  });

  it('lets a table owner that is not a superuser read its rows, as Supabase\'s postgres role does', async () => {
    const key = `rls-${randomUUID()}`;
    let ownerSees = -1;
    let ownerIsSuperuser: boolean | undefined;
    let ownerBypassesRls: boolean | undefined;
    await db
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`INSERT INTO "backoffice_gym"."rate_limits" (key, bucket, window_start, count) VALUES ($1, 'steps', now(), 1)`, key);
        await tx.$executeRawUnsafe('CREATE ROLE backoffice_gym_rls_owner NOSUPERUSER NOBYPASSRLS');
        await tx.$executeRawUnsafe('GRANT USAGE ON SCHEMA "backoffice_gym" TO backoffice_gym_rls_owner');
        await tx.$executeRawUnsafe('ALTER TABLE "backoffice_gym"."rate_limits" OWNER TO backoffice_gym_rls_owner');
        await tx.$executeRawUnsafe('SET LOCAL ROLE backoffice_gym_rls_owner');
        const [me] = await tx.$queryRawUnsafe<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>(
          'SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user',
        );
        ownerIsSuperuser = me?.rolsuper;
        ownerBypassesRls = me?.rolbypassrls;
        ownerSees = Number((await tx.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM "backoffice_gym"."rate_limits" WHERE key = $1`, key))[0]!.n);
        throw new Rollback();
      })
      .catch((e) => {
        if (!(e instanceof Rollback)) throw e;
      });
    expect(ownerIsSuperuser).toBe(false);
    expect(ownerBypassesRls).toBe(false);
    expect(ownerSees).toBe(1);
  });
});
