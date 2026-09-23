-- The Pengguna page's role/create/delete actions use the service-role client
-- (bypasses RLS) but still need the table-level GRANT — RLS bypass doesn't
-- imply privilege, same gotcha as 20260922000003 for `authenticated`.
-- "permission denied for table profiles" on a role change is this gap.
grant select, insert, update, delete on profiles to service_role;
