-- ==============================================================================
-- Migration: 20261007000001_prodi.sql
-- Description: S2 Psikologi Profesi alongside S1. A prodi column on every
-- per-prodi table (existing rows become 's1'), settings split per prodi with a
-- shared 'all' tier, a per-user prodi_access, and write policies gated by it.
-- Reads stay open: a clash message names the other prodi's class.
-- Dosen, ruangan and tahun akademik stay shared, so a dosen booked in S1 and S2
-- at the same hour is caught by the existing year-wide clash checks.
-- ==============================================================================

-- 1. The prodi column ----------------------------------------------------------
do $$
declare t text;
begin
    foreach t in array array['courses', 'students', 'sessions', 'schedules', 'exams', 'defenses']
    loop
        execute format(
            'alter table %I add column if not exists prodi varchar(2) not null default %L check (prodi in (%L, %L))',
            t, 's1', 's1', 's2'
        );
    end loop;
end $$;

-- S2 runs semesters 1-4, Reguler only.
alter table courses drop constraint if exists chk_courses_s2_smt;
alter table courses add constraint chk_courses_s2_smt check (prodi = 's1' or smt <= 4);

-- A schedule or exam may only use a mata kuliah of its own prodi.
alter table courses drop constraint if exists uq_courses_kode_prodi;
alter table courses add constraint uq_courses_kode_prodi unique (kode_mk, prodi);

alter table schedules drop constraint if exists schedules_kode_mk_fkey;
alter table schedules drop constraint if exists fk_schedules_course;
alter table schedules add constraint fk_schedules_course
    foreign key (kode_mk, prodi) references courses (kode_mk, prodi) on delete restrict;
alter table schedules drop constraint if exists chk_schedules_s2;
alter table schedules add constraint chk_schedules_s2 check (prodi = 's1' or (semester_ke <= 4 and jenis_kelas = 'reguler'));

alter table exams drop constraint if exists exams_kode_mk_fkey;
alter table exams drop constraint if exists fk_exams_course;
alter table exams add constraint fk_exams_course
    foreign key (kode_mk, prodi) references courses (kode_mk, prodi) on delete restrict;
alter table exams drop constraint if exists chk_exams_s2;
alter table exams add constraint chk_exams_s2 check (prodi = 's1' or (semester_ke <= 4 and jenis_kelas = 'reguler'));

create index if not exists idx_schedules_prodi on schedules (academic_year_id, prodi);
create index if not exists idx_exams_prodi on exams (academic_year_id, prodi);
create index if not exists idx_defenses_prodi on defenses (academic_year_id, prodi);

-- 2. Settings per prodi ------------------------------------------------------------
alter table settings add column if not exists prodi varchar(3) not null default 's1' check (prodi in ('s1', 's2', 'all'));
alter table settings drop constraint if exists settings_pkey;
alter table settings add primary key (key, prodi);

update settings set prodi = 'all'
where key in (
    'bentrok_dosen', 'bentrok_kelas', 'bentrok_ruangan', 'izinkan_override',
    'nama_universitas', 'nama_fakultas', 'kota',
    'nama_dekan', 'jabatan_dekan', 'gambar_tanda_tangan_dekan',
    'nama_wakil_dekan', 'jabatan_wakil_dekan'
);

insert into settings (key, value, type, "group", label, help, urutan, prodi)
select
    key,
    case key
        when 'nama_prodi' then 'S2 Psikologi Profesi'
        when 'nama_penandatangan' then ''
        when 'gambar_tanda_tangan' then ''
        when 'prasidang_header_baris' then replace(value, 'PRASIDANG SKRIPSI', 'SEMINAR PROPOSAL TESIS')
        when 'sidang_header_baris' then replace(value, 'SIDANG SKRIPSI', 'SIDANG TESIS')
        else value
    end,
    type, "group", label, help, urutan, 's2'
from settings
where prodi = 's1'
on conflict (key, prodi) do nothing;

-- 3. Who may write which prodi --------------------------------------------------------
alter table profiles add column if not exists prodi_access text not null default 's1'
    check (prodi_access in ('s1', 's2', 'all'));
-- Everyone signed up so far used S1 only; Super Admin sees everything regardless.
update profiles set prodi_access = 'all' where role = 'SUPERADMIN';

-- Same shape as is_scheduler_or_above(): security definer, fixed search_path.
-- p = 'all' (a shared settings row) passes only for access 'all' or SUPERADMIN.
create or replace function can_write_prodi(p text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from profiles
        where id = auth.uid()
          and role in ('SUPERADMIN', 'SCHEDULER')
          and (role = 'SUPERADMIN' or prodi_access = 'all' or prodi_access = p)
    )
$$;

do $$
declare t text;
begin
    foreach t in array array['courses', 'students', 'sessions', 'schedules', 'exams', 'defenses', 'settings']
    loop
        execute format('drop policy if exists %I on %I', t || '_insert', t);
        execute format('create policy %I on %I for insert to authenticated with check (can_write_prodi(prodi))', t || '_insert', t);
        execute format('drop policy if exists %I on %I', t || '_update', t);
        execute format('create policy %I on %I for update to authenticated using (can_write_prodi(prodi)) with check (can_write_prodi(prodi))', t || '_update', t);
        execute format('drop policy if exists %I on %I', t || '_delete', t);
        execute format('create policy %I on %I for delete to authenticated using (can_write_prodi(prodi))', t || '_delete', t);
    end loop;
end $$;

-- A dosen row belongs to its schedule's prodi.
drop policy if exists schedule_lecturers_insert on schedule_lecturers;
create policy schedule_lecturers_insert on schedule_lecturers for insert to authenticated
    with check (can_write_prodi((select s.prodi from schedules s where s.id = schedule_lecturers.schedule_id)));
drop policy if exists schedule_lecturers_update on schedule_lecturers;
create policy schedule_lecturers_update on schedule_lecturers for update to authenticated
    using (can_write_prodi((select s.prodi from schedules s where s.id = schedule_lecturers.schedule_id)))
    with check (can_write_prodi((select s.prodi from schedules s where s.id = schedule_lecturers.schedule_id)));
drop policy if exists schedule_lecturers_delete on schedule_lecturers;
create policy schedule_lecturers_delete on schedule_lecturers for delete to authenticated
    using (can_write_prodi((select s.prodi from schedules s where s.id = schedule_lecturers.schedule_id)));
