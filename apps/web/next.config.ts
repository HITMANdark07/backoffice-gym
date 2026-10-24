import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Trace server files from the monorepo root so workspace packages and the generated Prisma client ship to Vercel.
  outputFileTracingRoot: fileURLToPath(new URL('../..', import.meta.url)),
  // Workspace packages export TypeScript source; Next compiles them. Prisma and pg stay external (Node runtime).
  transpilePackages: ['@backoffice-gym/api', '@backoffice-gym/core', '@backoffice-gym/db', '@backoffice-gym/replay'],
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
};

export default nextConfig;
