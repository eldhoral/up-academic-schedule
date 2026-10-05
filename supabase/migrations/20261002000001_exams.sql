-- ==============================================================================
-- Migration: 20261002000001_exams.sql
-- Description: UTS/UAS (ujian tengah/akhir semester) schedule. One row per
-- mata kuliah x kelas (or kelas 'GABUNGAN'). The dosen pengampu is NOT stored:
-- it is read from `schedules` on the same natural key, so there is one source
-- of truth for who teaches what. Pengawas is an ordered jsonb list of
-- {"kode_dosen": "..."} or {"nama": "AKADEMIK"} (free text, for staff who
-- proctor when a dosen is unavailable). Tanggal/jam are null until scheduled.
-- Keterangan ujian is per kelas: kelas A may sit offline while kelas B is online.
-- ==============================================================================

create table if not exists exams (
    id uuid primary key default gen_random_uuid(),
    academic_year_id varchar(20) not null references academic_years(id) on delete cascade,
    jenis_ujian varchar(3) not null check (jenis_ujian in ('uts', 'uas')),
    jenis_kelas varchar(20) not null check (jenis_kelas in ('reguler', 'regsus')),
    semester_ke integer not null check (semester_ke between 1 and 8),
    kode_mk varchar(20) not null references courses(kode_mk) on delete restrict,
    kelas varchar(10) not null, -- 'A', 'B'... or 'GABUNGAN'
    tanggal date,
    jam_mulai time,
    jam_selesai time,
    room_id uuid references rooms(id) on delete set null,
    pengawas jsonb not null default '[]'::jsonb check (jsonb_typeof(pengawas) = 'array'),
    keterangan_ujian varchar(12) not null default 'offline'
        check (keterangan_ujian in ('offline', 'online', 'take_home', 'project', 'ujian_lisan')),
    is_override boolean not null default false,
    override_reason text not null default '',
    override_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    constraint chk_exams_scheduled check ((tanggal is null) = (jam_mulai is null) and (jam_mulai is null) = (jam_selesai is null)),
    constraint chk_exams_jam check (jam_selesai > jam_mulai),
    constraint uq_exams unique (academic_year_id, jenis_ujian, jenis_kelas, semester_ke, kode_mk, kelas)
);

create index if not exists idx_exams_lookup on exams (academic_year_id, jenis_ujian, jenis_kelas, semester_ke);
create index if not exists idx_exams_tanggal on exams (academic_year_id, tanggal) where tanggal is not null;

drop trigger if exists update_exams_updated_at on exams;
create trigger update_exams_updated_at
    before update on exams
    for each row execute function update_updated_at_column();

-- Same access tier as every data table: any authenticated user reads, only
-- SUPERADMIN/SCHEDULER writes (see 20260924000003_user_roles.sql).
alter table exams enable row level security;

drop policy if exists exams_select on exams;
create policy exams_select on exams for select to authenticated using (true);
drop policy if exists exams_insert on exams;
create policy exams_insert on exams for insert to authenticated with check (is_scheduler_or_above());
drop policy if exists exams_update on exams;
create policy exams_update on exams for update to authenticated using (is_scheduler_or_above()) with check (is_scheduler_or_above());
drop policy if exists exams_delete on exams;
create policy exams_delete on exams for delete to authenticated using (is_scheduler_or_above());

grant select, insert, update, delete on exams to authenticated;

drop trigger if exists audit_exams on exams;
create trigger audit_exams
    after insert or update or delete on exams
    for each row execute function audit_row();

-- Settings for the ujian pages (group 'ujian' in Pengaturan).
insert into settings (key, value, type, "group", label, help, urutan)
values
    ('sesi_ujian_reguler', '08:00-10:00,11:00-13:00,14:00-16:00', 'text', 'ujian', 'Sesi Ujian Reguler', 'Jam ujian yang jadi pilihan cepat untuk kelas reguler, format 08:00-10:00, dipisah koma', 1),
    ('sesi_ujian_regsus', '08:00-10:00,10:30-12:30,13:00-15:00,15:30-17:30,18:00-20:00', 'text', 'ujian', 'Sesi Ujian Reguler Khusus', 'Jam ujian yang jadi pilihan cepat untuk kelas reguler khusus, format 08:00-10:00, dipisah koma', 2),
    ('pengawas_cadangan', 'AKADEMIK', 'text', 'ujian', 'Pengawas Non-Dosen', 'Nama pengawas non-dosen yang jadi pilihan (mis. AKADEMIK), dipisah koma. Tidak dicek bentrok karena mewakili tim, bukan satu orang.', 3),
    ('ujian_header_baris', E'JADWAL EVALUASI {ujian} SEMESTER\nSEMESTER {semester}{program} ANGKATAN {angkatan_ta}\nSEMESTER {term} TAHUN AKADEMIK {tahun}', 'text', 'ujian', 'Judul Jadwal Ujian', 'Baris judul pada hasil cetak. {ujian}=TENGAH/AKHIR, {semester}, {program}, {angkatan_ta}, {term}, {tahun}', 4)
on conflict (key) do nothing;
