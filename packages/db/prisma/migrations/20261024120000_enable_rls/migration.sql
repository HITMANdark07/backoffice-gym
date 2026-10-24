-- Defence in depth. The app connects as the table owner, which bypasses RLS. With RLS on and no policies,
-- every other role (for example Supabase's anon and authenticated roles behind the Data API) reads nothing.
-- New tables need the same line; packages/db/src/rls.test.ts fails until they have it.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'backoffice_gym' LOOP
    EXECUTE format('ALTER TABLE "backoffice_gym".%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
