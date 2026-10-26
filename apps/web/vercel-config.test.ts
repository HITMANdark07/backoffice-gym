import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const deployDoc = readFileSync(new URL('../../docs/deploy.md', import.meta.url), 'utf8');
const workflow = (name: string) => readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), 'utf8');

describe('Vercel deployment config', () => {
  it('lets Vercel pick pnpm from packageManager via Corepack instead of overriding the install', () => {
    expect(vercel.installCommand).toBeUndefined();
    expect(deployDoc).toMatch(/ENABLE_EXPERIMENTAL_COREPACK.*\b1\b/);
  });

  it('generates the Prisma client, builds, and checks every page; runs in Mumbai with a daily cleanup', () => {
    expect(vercel.buildCommand).toBe('pnpm --filter @backoffice-gym/db generate && next build && node scripts/check-build.mjs');
    expect(vercel.regions).toEqual(['bom1']);
    expect(vercel.crons).toEqual([{ path: '/api/cron/cleanup', schedule: '30 21 * * *' }]);
  });

  it('leaves production deploys of main to GitHub, so migrations always run first', () => {
    expect(vercel.git).toEqual({ deploymentEnabled: { main: false } });
    const deploy = workflow('deploy.yml');
    expect(deploy).toMatch(/workflow_run:\s+workflows: \[ci\]\s+types: \[completed\]\s+branches: \[main\]/);
    expect(deploy).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(deploy).toContain("github.event.workflow_run.event == 'push'");
    expect(deploy).toContain('git ls-remote origin refs/heads/main');
    const migrate = deploy.indexOf('prisma migrate deploy');
    const hook = deploy.indexOf('curl -fsS -X POST "$DEPLOY_HOOK"');
    expect(migrate).toBeGreaterThan(0);
    expect(hook).toBeGreaterThan(migrate);
  });

  it('keeps the migrate workflow for manual runs only, so pushes do not migrate twice', () => {
    const migrate = workflow('migrate.yml');
    expect(migrate).toMatch(/^on:\n  workflow_dispatch:\n\n/m);
    expect(migrate).not.toMatch(/^\s+push:/m);
  });

  it('documents every secret and setting the deployment needs', () => {
    for (const name of ['CRON_SECRET', 'VERCEL_DEPLOY_HOOK_URL', 'BACKOFFICE_GYM_DB_CA_CERT', 'SUPABASE_MIGRATION_URL']) expect(deployDoc).toContain(name);
    expect(deployDoc).toMatch(/same `postgres\.<ref>` user/);
    expect(deployDoc).toMatch(/session pooler[^\n]*BACKOFFICE_GYM_DB_POOL_MAX` to `1`/);
  });
});
