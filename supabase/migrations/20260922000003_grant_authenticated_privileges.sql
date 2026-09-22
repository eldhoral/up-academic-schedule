-- ==============================================================================
-- Migration: 20260922000003_grant_authenticated_privileges.sql
-- Description: Grant table-level privileges to the `authenticated` role.
--
-- RLS policies (20260921000002) only filter which ROWS a query can see —
-- they don't grant access to the table itself. Without this GRANT, Postgres
-- blocks every query for `authenticated` before RLS is even evaluated:
-- "permission denied for table X" (Postgres error 42501), regardless of how
-- permissive the RLS policy is. Confirmed live: an authenticated session
-- returned 42501 on `courses` even though the "allow authenticated full
-- access" policy exists and the table has rows.
-- ==============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
