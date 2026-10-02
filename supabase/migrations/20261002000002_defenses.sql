-- ==============================================================================
-- Migration: 20261002000002_defenses.sql
-- Description: Prasidang and sidang (skripsi pre-defense and defense) schedule.
-- One row per mahasiswa per defense. NPM, nama, judul and the external examiner
-- live on the row itself, not in a mahasiswa master: the judul changes between
-- prasidang and sidang, each NPM appears at most twice, and nothing else needs a
-- mahasiswa. The two dosen roles read differently per jenis:
--   prasidang: pembimbing_kode = Dosen Pembimbing Pendamping, penguji_kode = Dosen Pembahas
--   sidang:    pembimbing_kode = Anggota Penguji II (pembimbing), penguji_kode = Ketua Sidang
-- Prasidang is held on Zoom in numbered breakout rooms (kelompok), sidang in a room.
-- ==============================================================================

create table if not exists defenses (
    id uuid primary key default gen_random_uuid(),
    academic_year_id varchar(20) not null references academic_years(id) on delete cascade,
    jenis varchar(10) not null check (jenis in ('prasidang', 'sidang')),
    tanggal date not null,
    jam_mulai time not null,
    jam_selesai time not null,
    room_id uuid references rooms(id) on delete set null, -- sidang
    kelompok smallint check (kelompok > 0), -- prasidang
    npm varchar(20) not null check (npm ~ '^[0-9]+$'),
    nama_mahasiswa text not null,
    judul_skripsi text not null default '',
    pembimbing_kode varchar(30) references lecturers(kode_dosen) on update cascade on delete restrict,
    penguji_kode varchar(30) references lecturers(kode_dosen) on update cascade on delete restrict,
    penguji_eksternal text not null default '', -- sidang: Anggota Penguji I
    is_override boolean not null default false,
    override_reason text not null default '',
    override_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    constraint chk_defenses_jam check (jam_selesai > jam_mulai),
    constraint chk_defenses_place check (
        (jenis = 'sidang' and kelompok is null)
        or (jenis = 'prasidang' and room_id is null and kelompok is not null and penguji_eksternal = '')
    ),
    constraint chk_defenses_distinct check (pembimbing_kode is null or penguji_kode is null or pembimbing_kode <> penguji_kode),
    constraint uq_defenses_npm unique (academic_year_id, jenis, npm)
);

create index if not exists idx_defenses_lookup on defenses (academic_year_id, jenis, tanggal);
create index if not exists idx_defenses_npm on defenses (npm);

drop trigger if exists update_defenses_updated_at on defenses;
create trigger update_defenses_updated_at
    before update on defenses
    for each row execute function update_updated_at_column();

-- Same access tier as every data table: any authenticated user reads, only
-- SUPERADMIN/SCHEDULER writes (see 20260924000003_user_roles.sql).
alter table defenses enable row level security;

drop policy if exists defenses_select on defenses;
create policy defenses_select on defenses for select to authenticated using (true);
drop policy if exists defenses_insert on defenses;
create policy defenses_insert on defenses for insert to authenticated with check (is_scheduler_or_above());
drop policy if exists defenses_update on defenses;
create policy defenses_update on defenses for update to authenticated using (is_scheduler_or_above()) with check (is_scheduler_or_above());
drop policy if exists defenses_delete on defenses;
create policy defenses_delete on defenses for delete to authenticated using (is_scheduler_or_above());

grant select, insert, update, delete on defenses to authenticated;

drop trigger if exists audit_defenses on defenses;
create trigger audit_defenses
    after insert or update or delete on defenses
    for each row execute function audit_row();

-- Settings for the sidang pages (group 'sidang' in Pengaturan). The header
-- templates and signers are used by the print pages.
insert into settings (key, value, type, "group", label, help, urutan)
values
    ('sesi_prasidang', '08:00-09:00,09:00-10:00,10:30-11:30,13:00-14:00,14:30-15:30', 'text', 'sidang', 'Sesi Prasidang', 'Jam prasidang yang jadi baris papan jadwal, format 08:00-09:00, dipisah koma', 1),
    ('sesi_sidang', '08:00-10:00,10:00-12:00,13:00-15:00,15:00-17:00', 'text', 'sidang', 'Sesi Sidang', 'Jam sidang yang jadi baris papan jadwal, format 08:00-10:00, dipisah koma', 2),
    ('prasidang_zoom_id', '', 'text', 'sidang', 'ID Zoom Prasidang', 'ID Zoom yang dicetak pada jadwal prasidang', 3),
    ('prasidang_zoom_passcode', '', 'text', 'sidang', 'Passcode Zoom Prasidang', 'Passcode Zoom yang dicetak pada jadwal prasidang', 4),
    ('nama_wakil_dekan', 'DR. VINAYA, M.SI', 'text', 'sidang', 'Nama Wakil Dekan I', 'Penandatangan "Mengetahui" pada jadwal prasidang dan sidang', 5),
    ('jabatan_wakil_dekan', 'WAKIL DEKAN I', 'text', 'sidang', 'Jabatan Wakil Dekan I', 'Jabatan penandatangan "Mengetahui"', 6),
    ('prasidang_header_baris', E'JADWAL PRASIDANG SKRIPSI SEMESTER {term} TAHUN AKADEMIK {tahun}\n{tanggal}\nKELOMPOK {kelompok}', 'text', 'sidang', 'Judul Jadwal Prasidang', 'Baris judul tiap halaman. {term}, {tahun}, {tanggal}, {kelompok}', 7),
    ('sidang_header_baris', E'JADWAL SIDANG SKRIPSI SEMESTER {term} TAHUN AKADEMIK {tahun}\n{tanggal}\nRUANG {ruang}\nFAKULTAS PSIKOLOGI UNIVERSITAS PANCASILA', 'text', 'sidang', 'Judul Jadwal Sidang', 'Baris judul tiap halaman. {term}, {tahun}, {tanggal}, {ruang}', 8)
on conflict (key) do nothing;
