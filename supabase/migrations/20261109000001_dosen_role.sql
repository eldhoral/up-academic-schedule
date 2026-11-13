-- ==============================================================================
-- Migration: 20261109000001_dosen_role.sql
-- Description: DOSEN role. A DOSEN account is linked to exactly one lecturer
-- and grades its own prasidang students. It holds a real Supabase JWT and the
-- anon key is public, so every staff read policy now requires is_staff(): a
-- DOSEN reads only its own profiles row (grade tables add their own policies).
-- ==============================================================================

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
    check (role in ('SUPERADMIN', 'SCHEDULER', 'VIEWER', 'DOSEN'));

alter table profiles add column if not exists kode_dosen varchar(30) null
    references lecturers(kode_dosen) on update cascade on delete set null;

-- Staff accounts never have a kode_dosen; a DOSEN always has one.
alter table profiles drop constraint if exists profiles_kode_dosen_role_check;
alter table profiles add constraint profiles_kode_dosen_role_check
    check ((role = 'DOSEN') = (kode_dosen is not null));

-- One DOSEN account per lecturer. Partial: the sidang design adds several day-accounts for one external examiner.
create unique index if not exists profiles_dosen_kode_dosen_key on profiles (kode_dosen) where role = 'DOSEN';

-- Same shape as is_superadmin(): security definer, fixed search_path.
create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from profiles where id = auth.uid() and role in ('SUPERADMIN', 'SCHEDULER', 'VIEWER'))
$$;

-- The caller's lecturer, or null for staff and signed-out callers.
create or replace function my_kode_dosen()
returns varchar
language sql
stable
security definer
set search_path = public
as $$
    select kode_dosen from profiles where id = auth.uid() and role = 'DOSEN'
$$;

-- (select is_staff()) runs once per query instead of once per row.
do $$
declare t text;
begin
    foreach t in array array[
        'academic_years', 'courses', 'lecturers', 'rooms',
        'sessions', 'schedules', 'schedule_lecturers', 'settings',
        'students', 'exams', 'defenses'
    ]
    loop
        execute format('drop policy if exists %I on %I', t || '_select', t);
        execute format('create policy %I on %I for select to authenticated using ((select is_staff()))', t || '_select', t);
    end loop;
end $$;

drop policy if exists holidays_select_authenticated on holidays;
create policy holidays_select_authenticated on holidays for select to authenticated using ((select is_staff()));

drop policy if exists audit_log_select_authenticated on audit_log;
create policy audit_log_select_authenticated on audit_log for select to authenticated using ((select is_staff()));

drop policy if exists profiles_select_authenticated on profiles;
create policy profiles_select_authenticated on profiles for select to authenticated
    using ((select is_staff()) or id = auth.uid());
