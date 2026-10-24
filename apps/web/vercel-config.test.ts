import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const deployDoc = readFileSync(new URL('../../docs/deploy.md', import.meta.url), 'utf8');

describe('Vercel deployment config', () => {
  it('lets Vercel pick pnpm from packageManager via Corepack instead of overriding the install', () => {
    expect(vercel.installCommand).toBeUndefined();
    expect(deployDoc).toMatch(/ENABLE_EXPERIMENTAL_COREPACK.*\b1\b/);
  });

  it('generates the Prisma client, builds, and checks every page; runs in Mumbai with a daily cleanup', () => {
    expect(vercel.buildCommand).toBe('pnpm --filter @backoffice-gym/db generate && next build && node scripts/check-build.mjs');
    expect(vercel.regions).toEqual(['bom1']);
    expect(vercel.crons).toEqual([{ path: '/api/health', schedule: '30 21 * * *' }]);
  });
});
