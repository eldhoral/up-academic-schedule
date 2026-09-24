-- Login/logout entries are inserted from src/app/actions/auth.ts with the
-- service-role client, which bypasses RLS but still needs the table-level
-- GRANT (same gotcha as 20260924000004 for profiles). Without it every
-- LOGIN/LOGOUT insert fails with "permission denied for table audit_log".
grant select, insert on audit_log to service_role;
