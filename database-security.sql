-- The browser never queries application records through the Supabase Data API.
-- Firebase identity is verified in Express; Prisma uses a server-only DB connection.
-- Apply to both local PostgreSQL and Supabase after Prisma schema migrations.
DO $$
DECLARE application_table record;
BEGIN
  FOR application_table IN SELECT tablename FROM pg_tables WHERE schemaname='geki'
  LOOP
    EXECUTE format('ALTER TABLE geki.%I ENABLE ROW LEVEL SECURITY',application_table.tablename);
    IF application_table.tablename <> '_prisma_migrations' AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname='geki_api') THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON geki.%I TO geki_api',application_table.tablename);
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='geki' AND tablename=application_table.tablename AND policyname='deny_data_api') THEN
      EXECUTE format('CREATE POLICY deny_data_api ON geki.%I AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false)',application_table.tablename);
    END IF;
  END LOOP;
  REVOKE ALL ON SCHEMA geki FROM PUBLIC;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON SCHEMA geki FROM anon;
    REVOKE ALL ON ALL TABLES IN SCHEMA geki FROM anon;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON SCHEMA geki FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA geki FROM authenticated;
  END IF;
END $$;
