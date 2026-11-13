-- ==============================================================================
-- Migration: 20261116000002_eksternal_cleanup.sql
-- Description: Nightly, delete EKSTERNAL day accounts expired more than 30 days
-- (purge_expired_eksternal, defined in 20261116000001_nilai_sidang.sql).
-- pg_cron runs in UTC: 20:30 UTC is 03:30 WIB. scripts/check-prodi-db.sh skips
-- this file (pg_cron exists only on Supabase).
-- ==============================================================================
create extension if not exists pg_cron;

do $$
begin
    perform cron.unschedule('purge_expired_eksternal');
exception when others then
    null; -- job didn't exist yet, nothing to unschedule
end $$;

select cron.schedule('purge_expired_eksternal', '30 20 * * *', 'select purge_expired_eksternal()');
