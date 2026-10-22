import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      process.env.SHOPGYM_DATABASE_URL ??
      `postgresql://${process.env.USER}@localhost:5432/shopgym_dev`,
  },
});
