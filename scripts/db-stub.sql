-- Stand-ins for what Supabase provides, so supabase/migrations run on plain Postgres.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
-- Supabase reads the JWT; here the test sets request.jwt.claim.sub itself.
create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant all on storage.objects to authenticated;

grant usage on schema public to anon, authenticated, service_role;

-- 20260924000007_audit_log_retention needs pg_cron, so check-prodi-db.sh skips it; its function is
-- defined here so later migrations can change its grants. Body unchecked: audit_log comes later.
set check_function_bodies = off;
create function purge_old_audit_log() returns void language sql security definer set search_path = public as $$
    delete from audit_log where at < now() - interval '1 month';
$$;
reset check_function_bodies;
