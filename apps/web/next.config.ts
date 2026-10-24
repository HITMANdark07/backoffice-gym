import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Workspace packages export TypeScript source; Next compiles them. Prisma and pg stay external (Node runtime).
  transpilePackages: ['@backoffice-gym/api', '@backoffice-gym/core', '@backoffice-gym/db', '@backoffice-gym/replay'],
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'pg'],
};

export default nextConfig;
