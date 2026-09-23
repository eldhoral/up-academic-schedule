-- ==============================================================================
-- Migration: 20260924000003_user_roles.sql
-- Description: User roles (SUPERADMIN, SCHEDULER, VIEWER) via a `profiles`
-- table keyed to auth.users, plus role-aware RLS: everyone authenticated can
-- still read, only SUPERADMIN/SCHEDULER can write. VIEWER is read-only.
-- ==============================================================================

create table if not exists profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    role text not null default 'VIEWER' check (role in ('SUPERADMIN', 'SCHEDULER', 'VIEWER')),
    created_at timestamptz not null default timezone('utc'::text, now())
);

alter table profiles enable row level security;

-- Every authenticated user can read the roster (roles aren't secret among
-- staff) — this also lets the profiles-referencing helper functions below
-- work without recursion. No insert/update/delete policy is defined here on
-- purpose: all writes go through server actions using the service-role
-- client (see src/lib/supabase/admin.ts), which bypasses RLS entirely, so a
-- browser session can never grant itself a role change directly.
drop policy if exists "profiles_select_authenticated" on profiles;
create policy "profiles_select_authenticated"
    on profiles for select
    to authenticated
    using (true);

grant select on profiles to authenticated;

-- New auth.users rows get a profile automatically, defaulting to the least
-- privileged role; an admin promotes from the Pengguna page afterward.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into profiles (id, email, role)
    values (new.id, new.email, 'VIEWER')
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function handle_new_user();

-- Backfill: every account that already exists today becomes SUPERADMIN, so
-- nobody currently using the app gets locked out. Adjust from the Pengguna
-- page afterward.
insert into profiles (id, email, role)
select id, email, 'SUPERADMIN' from auth.users
on conflict (id) do nothing;

-- Role-check helper for RLS policies below. security definer + a fixed
-- search_path so it reads profiles under its own permissions regardless of
-- the caller's RLS, and can't be hijacked by a same-named function elsewhere.
create or replace function is_scheduler_or_above()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from profiles
        where id = auth.uid() and role in ('SUPERADMIN', 'SCHEDULER')
    )
$$;

-- Replace the old "authenticated = full access" policy on every data table
-- with: SELECT for any authenticated user (VIEWER included), writes gated to
-- SUPERADMIN/SCHEDULER. Looping avoids re-typing the same four policies
-- eight times over.
do $$
declare
    t text;
begin
    foreach t in array array[
        'academic_years', 'courses', 'lecturers', 'rooms',
        'sessions', 'schedules', 'schedule_lecturers', 'settings'
    ]
    loop
        execute format('drop policy if exists %L on %I', 'Allow authenticated users full access to ' || t, t);

        execute format('drop policy if exists %L on %I', t || '_select', t);
        execute format(
            'create policy %L on %I for select to authenticated using (true)',
            t || '_select', t
        );

        execute format('drop policy if exists %L on %I', t || '_insert', t);
        execute format(
            'create policy %L on %I for insert to authenticated with check (is_scheduler_or_above())',
            t || '_insert', t
        );

        execute format('drop policy if exists %L on %I', t || '_update', t);
        execute format(
            'create policy %L on %I for update to authenticated using (is_scheduler_or_above()) with check (is_scheduler_or_above())',
            t || '_update', t
        );

        execute format('drop policy if exists %L on %I', t || '_delete', t);
        execute format(
            'create policy %L on %I for delete to authenticated using (is_scheduler_or_above())',
            t || '_delete', t
        );
    end loop;
end $$;
