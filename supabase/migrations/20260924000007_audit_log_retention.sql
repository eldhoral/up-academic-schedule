-- Data retention: audit_log entries older than 1 month are purged nightly.
-- pg_cron runs inside the database, so this works regardless of whether the
-- app itself is running.
create extension if not exists pg_cron;

create or replace function purge_old_audit_log()
returns void
language sql
security definer
set search_path = public
as $$
    delete from audit_log where at < now() - interval '1 month';
$$;

do $$
begin
    perform cron.unschedule('purge_old_audit_log');
exception when others then
    null; -- job didn't exist yet, nothing to unschedule
end $$;

select cron.schedule('purge_old_audit_log', '0 3 * * *', 'select purge_old_audit_log()');
