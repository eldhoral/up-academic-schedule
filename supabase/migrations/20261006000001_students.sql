-- ==============================================================================
-- Migration: 20261006000001_students.sql
-- Description: Mahasiswa master for prasidang and sidang. A defense still keeps
-- its own NPM, nama and judul (the judul may be revised between prasidang and
-- sidang); the master is where the form looks a student up by NPM, and what the
-- Data Master page exports to and imports from xlsx. Seeded from the defenses
-- already entered, taking the latest judul (sidang over prasidang).
-- ==============================================================================

create table if not exists students (
    id uuid primary key default gen_random_uuid(),
    npm varchar(20) not null unique check (npm ~ '^[0-9]+$'),
    nama text not null check (btrim(nama) <> ''),
    judul_skripsi text not null default '',
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

drop trigger if exists update_students_updated_at on students;
create trigger update_students_updated_at
    before update on students
    for each row execute function update_updated_at_column();

-- Same access tier as every data table: any authenticated user reads, only
-- SUPERADMIN/SCHEDULER writes (see 20260924000003_user_roles.sql).
alter table students enable row level security;

drop policy if exists students_select on students;
create policy students_select on students for select to authenticated using (true);
drop policy if exists students_insert on students;
create policy students_insert on students for insert to authenticated with check (is_scheduler_or_above());
drop policy if exists students_update on students;
create policy students_update on students for update to authenticated using (is_scheduler_or_above()) with check (is_scheduler_or_above());
drop policy if exists students_delete on students;
create policy students_delete on students for delete to authenticated using (is_scheduler_or_above());

grant select, insert, update, delete on students to authenticated;

drop trigger if exists audit_students on students;
create trigger audit_students
    after insert or update or delete on students
    for each row execute function audit_row();

insert into students (npm, nama, judul_skripsi)
select distinct on (npm) npm, nama_mahasiswa, judul_skripsi
from defenses
order by npm, tanggal desc
on conflict (npm) do nothing;
