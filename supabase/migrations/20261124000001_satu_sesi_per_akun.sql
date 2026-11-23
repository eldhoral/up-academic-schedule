-- ==============================================================================
-- Migration: 20261124000001_satu_sesi_per_akun.sql
-- Description: One active login per account (faculty feedback, 2026-11-24). While
-- user A's session is active, signing in to the same account elsewhere is refused
-- until A signs out, or A's browser has been idle for the Pengaturan idle limit
-- (sesi_idle_menit, the same limit after which A's browser signs itself out).
--
-- sesi_aktif holds, per account, the session (JWT claim session_id) that owns it and
-- when that browser was last active. Rows are written only through the functions
-- below, which take the user and session from the caller's own JWT.
-- ==============================================================================

create table if not exists sesi_aktif (
    user_id uuid primary key references auth.users(id) on delete cascade,
    session_id uuid not null,
    terakhir timestamptz not null default now()
);
alter table sesi_aktif enable row level security;
revoke all on sesi_aktif from anon, authenticated;

-- The idle limit in minutes, as menitIdle() in TS: below 5 or unreadable = 30, at most 720.
create or replace function sesi_idle_menit()
returns int
language sql
stable
security definer
set search_path = public
as $$
    -- Nested CASE: the cast runs only on a value the regex accepted (AND may evaluate either side first).
    select case when v ~ '^\s*\d{1,6}\s*$' then (case when btrim(v)::int >= 5 then least(btrim(v)::int, 720) else 30 end) else 30 end
    from (select coalesce((select value from settings where key = 'sesi_idle_menit' and prodi = 'all'), '') as v) s
$$;

-- The caller's session id, from its access token.
create or replace function sesi_saya()
returns uuid
language sql
stable
as $$
    select nullif(auth.jwt() ->> 'session_id', '')::uuid
$$;

-- Right after a password sign-in: take the account for this session. False when another session
-- was active within the idle limit (the caller then signs this new session out).
create or replace function klaim_sesi()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
    sid uuid := sesi_saya();
    n int;
begin
    if uid is null or sid is null then return false; end if;
    insert into sesi_aktif (user_id, session_id, terakhir) values (uid, sid, now())
    on conflict (user_id) do update set session_id = excluded.session_id, terakhir = now()
        where sesi_aktif.session_id = excluded.session_id
           or sesi_aktif.terakhir < now() - make_interval(mins => sesi_idle_menit());
    get diagnostics n = row_count;
    return n = 1;
end;
$$;

-- Activity in the owning browser (at most once a minute). A session that doesn't own the account changes
-- nothing, except that it takes over an account nobody holds (sessions signed in before this migration).
create or replace function sentuh_sesi()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    uid uuid := auth.uid();
    sid uuid := sesi_saya();
begin
    if uid is null or sid is null then return; end if;
    insert into sesi_aktif (user_id, session_id, terakhir) values (uid, sid, now())
    on conflict (user_id) do update set terakhir = now()
        where sesi_aktif.session_id = excluded.session_id;
end;
$$;

-- Sign-out (button or idle): free the account, only if this session holds it.
create or replace function lepas_sesi()
returns void
language sql
security definer
set search_path = public
as $$
    delete from sesi_aktif where user_id = auth.uid() and session_id = sesi_saya()
$$;

revoke execute on function sesi_idle_menit(), klaim_sesi(), sentuh_sesi(), lepas_sesi() from public, anon;
grant execute on function klaim_sesi(), sentuh_sesi(), lepas_sesi() to authenticated;
