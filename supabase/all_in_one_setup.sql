-- ==============================================================================
-- ALL-IN-ONE SETUP FOR KRS SCHEDULING SYSTEM
-- Study Program: S1 Psikologi, Fakultas Psikologi, Universitas Pancasila
--
-- Run this in your Supabase SQL Editor if you are not using the Supabase CLI.
-- Concatenation of every migration in migrations/, in order. This script:
-- 1. Creates tables (academic_years, courses, lecturers, rooms, sessions, schedules, schedule_lecturers, settings)
-- 2. Adds triggers for updated_at
-- 3. Enables Row Level Security (RLS) policies
-- 4. Seeds the active academic year (2026/2027 Gasal) and all settings keys
-- 5. Seeds the real 2026/2027 Gasal data: all 71 courses, 21 lecturers, 4 rooms,
--    and the 96 real schedule rows (see that section's own header comment below
--    for sourcing notes and known limitations — synthetic lecturer codes, etc.)
--
-- Keep this file in sync with migrations/ — if you add a migration, append it
-- here too, or this "fastest" path silently falls behind the CLI path.
-- ==============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Updated At Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------------------------

-- Academic Years
CREATE TABLE IF NOT EXISTS academic_years (
    id VARCHAR(20) PRIMARY KEY,
    label TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS update_academic_years_updated_at ON academic_years;
CREATE TRIGGER update_academic_years_updated_at
    BEFORE UPDATE ON academic_years
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Courses (2026 Curriculum)
CREATE TABLE IF NOT EXISTS courses (
    kode_mk VARCHAR(20) PRIMARY KEY,
    nama_mk TEXT NOT NULL,
    sks INTEGER NOT NULL CHECK (sks > 0),
    smt INTEGER NOT NULL CHECK (smt BETWEEN 1 AND 8),
    jenis_mk VARCHAR(1) NOT NULL CHECK (jenis_mk IN ('A', 'B')),
    kurikulum VARCHAR(20) NOT NULL DEFAULT '2026',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_courses_smt ON courses (smt);
CREATE INDEX IF NOT EXISTS idx_courses_kurikulum ON courses (kurikulum);

DROP TRIGGER IF EXISTS update_courses_updated_at ON courses;
CREATE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON courses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Lecturers
CREATE TABLE IF NOT EXISTS lecturers (
    kode_dosen VARCHAR(30) PRIMARY KEY,
    nidn VARCHAR(20),
    nama TEXT NOT NULL,
    gelar_depan TEXT NOT NULL DEFAULT '',
    gelar_belakang TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lecturers_nama ON lecturers (nama);

DROP TRIGGER IF EXISTS update_lecturers_updated_at ON lecturers;
CREATE TRIGGER update_lecturers_updated_at
    BEFORE UPDATE ON lecturers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama VARCHAR(50) NOT NULL UNIQUE,
    kapasitas INTEGER NOT NULL DEFAULT 0,
    keterangan TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;
CREATE TRIGGER update_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hari VARCHAR(10) NOT NULL CHECK (hari IN ('SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU')),
    sesi_ke INTEGER NOT NULL,
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    sks INTEGER NOT NULL CHECK (sks > 0),
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_sessions_time_range CHECK (jam_selesai > jam_mulai)
);

CREATE INDEX IF NOT EXISTS idx_sessions_hari ON sessions (hari);

DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Schedules
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id VARCHAR(20) NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    jenis_kelas VARCHAR(20) NOT NULL CHECK (jenis_kelas IN ('reguler', 'regsus')),
    semester_ke INTEGER NOT NULL CHECK (semester_ke BETWEEN 1 AND 8),
    kode_mk VARCHAR(20) NOT NULL REFERENCES courses(kode_mk) ON DELETE RESTRICT,
    kelas VARCHAR(5) NOT NULL,
    hari VARCHAR(10) NOT NULL CHECK (hari IN ('SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU')),
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
    zoom_id VARCHAR(50) NOT NULL DEFAULT '',
    jumlah_mhs INTEGER NOT NULL DEFAULT 0,
    minggu VARCHAR(10) NOT NULL DEFAULT 'setiap' CHECK (minggu IN ('setiap', 'ganjil', 'genap')),
    keterangan TEXT NOT NULL DEFAULT '',
    is_override BOOLEAN NOT NULL DEFAULT false,
    override_reason TEXT NOT NULL DEFAULT '',
    override_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_schedules_time_range CHECK (jam_selesai > jam_mulai),
    CONSTRAINT uq_schedules_class UNIQUE (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas)
);

CREATE INDEX IF NOT EXISTS idx_schedules_lookup 
    ON schedules (academic_year_id, jenis_kelas, semester_ke);
CREATE INDEX IF NOT EXISTS idx_schedules_timing 
    ON schedules (academic_year_id, hari, jam_mulai, jam_selesai);
CREATE INDEX IF NOT EXISTS idx_schedules_room 
    ON schedules (room_id) WHERE room_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_schedules_updated_at ON schedules;
CREATE TRIGGER update_schedules_updated_at
    BEFORE UPDATE ON schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Schedule Lecturers
CREATE TABLE IF NOT EXISTS schedule_lecturers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    kode_dosen VARCHAR(30) NOT NULL REFERENCES lecturers(kode_dosen) ON DELETE CASCADE,
    urutan INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_schedule_lecturer UNIQUE (schedule_id, kode_dosen)
);

CREATE INDEX IF NOT EXISTS idx_schedule_lecturers_dosen 
    ON schedule_lecturers (kode_dosen);
CREATE INDEX IF NOT EXISTS idx_schedule_lecturers_schedule 
    ON schedule_lecturers (schedule_id);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    type VARCHAR(20) NOT NULL CHECK (type IN ('int', 'time', 'text', 'bool', 'image')),
    "group" VARCHAR(30) NOT NULL,
    label TEXT NOT NULL,
    help TEXT NOT NULL DEFAULT '',
    urutan INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_settings_group 
    ON settings ("group");

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 2. Row Level Security (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_lecturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated users full access to academic_years" ON academic_years;
    CREATE POLICY "Allow authenticated users full access to academic_years" ON academic_years FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow authenticated users full access to courses" ON courses;
    CREATE POLICY "Allow authenticated users full access to courses" ON courses FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow authenticated users full access to lecturers" ON lecturers;
    CREATE POLICY "Allow authenticated users full access to lecturers" ON lecturers FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow authenticated users full access to rooms" ON rooms;
    CREATE POLICY "Allow authenticated users full access to rooms" ON rooms FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow authenticated users full access to sessions" ON sessions;
    CREATE POLICY "Allow authenticated users full access to sessions" ON sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow authenticated users full access to schedules" ON schedules;
    CREATE POLICY "Allow authenticated users full access to schedules" ON schedules FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow authenticated users full access to schedule_lecturers" ON schedule_lecturers;
    CREATE POLICY "Allow authenticated users full access to schedule_lecturers" ON schedule_lecturers FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow authenticated users full access to settings" ON settings;
    CREATE POLICY "Allow authenticated users full access to settings" ON settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;

-- ------------------------------------------------------------------------------
-- 3. Initial Seeds
-- ------------------------------------------------------------------------------

-- Seed Academic Year
INSERT INTO academic_years (id, label, is_active)
VALUES ('20261', '2026/2027 Gasal', true)
ON CONFLICT (id) DO UPDATE 
SET label = EXCLUDED.label, 
    is_active = EXCLUDED.is_active;

-- Seed Settings
INSERT INTO settings (key, value, type, "group", label, help, urutan)
VALUES
    -- Waktu & sesi
    ('menit_per_sks', '50', 'int', 'waktu', 'Menit per SKS', 'Durasi standar 1 SKS dalam menit (default: 50 menit)', 1),
    ('jeda_menit', '10', 'int', 'waktu', 'Jeda antar sesi (menit)', 'Jeda istirahat antar sesi perkuliahan berturut-turut', 2),
    ('jam_mulai_reguler', '07:30', 'time', 'waktu', 'Jam mulai kelas reguler', 'Waktu mulai perkuliahan pagi/reguler', 3),
    ('jam_mulai_regsus', '18:00', 'time', 'waktu', 'Jam mulai kelas reguler khusus', 'Waktu mulai perkuliahan sore/malam reguler khusus', 4),
    ('jam_istirahat_mulai', '12:10', 'time', 'waktu', 'Mulai istirahat siang', 'Awal waktu istirahat tengah hari yang dilewati generator sesi', 5),
    ('jam_istirahat_selesai', '13:00', 'time', 'waktu', 'Selesai istirahat siang', 'Akhir waktu istirahat tengah hari yang dilewati generator sesi', 6),
    ('hari_aktif', 'SENIN,SELASA,RABU,KAMIS,JUMAT,SABTU', 'text', 'waktu', 'Hari aktif kuliah', 'Daftar hari yang diaktifkan untuk penjadwalan', 7),

    -- Kelas
    ('kelas_maksimal', 'Z', 'text', 'kelas', 'Batas huruf kelas', 'Huruf kelas maksimal yang ditampilkan pada dropdown pilihan kelas', 1),
    ('maks_mahasiswa_per_kelas', '50', 'int', 'kelas', 'Maksimum mahasiswa per kelas', 'Batas peringatan jumlah mahasiswa per kelas (advisory)', 2),
    ('min_mahasiswa_pilihan', '10', 'int', 'kelas', 'Minimum mahasiswa MK pilihan', 'Batas peringatan kuota minimum peserta kelas pilihan (advisory)', 3),

    -- Bentrok
    ('bentrok_dosen', 'blok', 'text', 'bentrok', 'Penanganan bentrok dosen', 'Tindakan jika jadwal dosen bertabrakan (blok / peringatan / abaikan)', 1),
    ('bentrok_kelas', 'blok', 'text', 'bentrok', 'Penanganan bentrok kelas', 'Tindakan jika jadwal kelas bertabrakan (blok / peringatan / abaikan)', 2),
    ('bentrok_ruangan', 'peringatan', 'text', 'bentrok', 'Penanganan bentrok ruangan', 'Tindakan jika penggunaan ruangan bertabrakan (blok / peringatan / abaikan)', 3),
    ('izinkan_override', 'ya', 'text', 'bentrok', 'Izinkan override bentrok', 'Izinkan admin menyimpan jadwal bentrok dengan alasan khusus (ya / tidak)', 4),

    -- Cetak
    ('nama_universitas', 'Universitas Pancasila', 'text', 'cetak', 'Nama Universitas', 'Nama institusi perguruan tinggi untuk kop dokumen', 1),
    ('nama_fakultas', 'Fakultas Psikologi', 'text', 'cetak', 'Nama Fakultas', 'Nama fakultas untuk kop dokumen', 2),
    ('kota', 'Jakarta', 'text', 'cetak', 'Kota', 'Kota institusi untuk titimangsa tanda tangan', 3),
    ('nama_prodi', 'S1 Psikologi', 'text', 'cetak', 'Nama Program Studi', 'Nama program studi untuk kop dan laporan', 4),
    ('zoom_id', '560 278 1304', 'text', 'cetak', 'Default Zoom ID', 'ID ruang rapat Zoom default untuk perkuliahan daring', 5),
    ('zoom_passcode', '2026', 'text', 'cetak', 'Default Zoom Passcode', 'Passcode ruang rapat Zoom default', 6),
    ('header_baris', E'JADWAL PERKULIAHAN SEMESTER {semester}\nPROGRAM STUDI S1 PSIKOLOGI - ANGKATAN {angkatan}\nTAHUN AKADEMIK {tahun_akademik}', 'text', 'cetak', 'Baris Header Cetak', 'Format teks 4 baris header lembar jadwal cetak', 7),
    ('keterangan_cetak', E'1. WAKTU KULIAH : 1 SKS = 50 MENIT\n2. KELAS GABUNGAN, MAKSIMAL 1 KELAS 50 ORANG\n3. MAHASISWA WAJIB HADIR TEPAT WAKTU', 'text', 'cetak', 'Keterangan Cetak', 'Catatan informasi pada bagian bawah lembar jadwal cetak', 8),
    ('nama_penandatangan', 'FARIDA AINI, M.PSI., PSIKOLOG', 'text', 'cetak', 'Nama Penandatangan', 'Nama lengkap pejabat penandatangan lembar jadwal', 9),
    ('jabatan_penandatangan', 'KETUA PROGRAM STUDI', 'text', 'cetak', 'Jabatan Penandatangan', 'Jabatan resmi penandatangan jadwal', 10),
    ('gambar_tanda_tangan', '', 'image', 'cetak', 'Gambar Tanda Tangan', 'URL atau base64 gambar stempel / tanda tangan (opsional)', 11),
    ('ukuran_kertas', 'A4', 'text', 'cetak', 'Ukuran Kertas', 'Ukuran kertas pencetakan dokumen (A4 / Letter / Legal)', 12),
    ('orientasi', 'portrait', 'text', 'cetak', 'Orientasi Cetak', 'Orientasi kertas pencetakan dokumen (portrait / landscape)', 13)
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value,
    type = EXCLUDED.type,
    "group" = EXCLUDED."group",
    label = EXCLUDED.label,
    help = EXCLUDED.help,
    urutan = EXCLUDED.urutan;
-- ==============================================================================
-- Migration: 20260922000002_seed_2026_2027_gasal.sql
-- Description: Seed the real 2026/2027 Gasal schedule — PLAN.md §6b, §7, §7b.
--
-- Source: docs/Jadwal Perkuliahan Gasal 2026 2027_Final+jml mhs.xlsx, sheets
-- "SMTR I/III/V" (reguler) and "SMTR I/III/V - RK" (reguler khusus). 96 rows
-- total, cross-checked against the printed PDFs in docs/. Also seeds the full
-- 71-row course catalog from docs/db matakuliah.xlsx, verbatim — schedules
-- below FK-reference it.
--
-- Generated by a one-off Node script (not checked in — its job ended when this
-- file was written) that: parsed the six sheets; translated the pre-2026
-- course codes used by semesters III and V to their 2026-curriculum kode_mk
-- per PLAN.md §7b's 20-entry table; read minggu (setiap/ganjil/genap) off the
-- "(A)"/"(B)" suffix the two source sheets carry for Reguler Khusus rows; and
-- flagged the five real conflicts from PLAN.md §7 as accepted overrides.
--
-- Known limitations, on purpose rather than by oversight:
--
-- 1. LECTURERS ARE PARTLY SYNTHETIC. docs/db dosen.xlsx has only 4 real
--    kode_dosen/NIDN records; PLAN.md §8 confirms no full SIAKUP export was
--    available at build time. Those 4 are matched by de-titled name to their
--    schedule-sheet entries and seeded with real data. The other 17 lecturers
--    who appear in the schedule but not in that sample file get a synthetic
--    kode_dosen (SEED0001..SEED0017) so the primary key is never null.
--
--    THIS MEANS: when the real, complete dosen export eventually lands and is
--    uploaded through the Dosen import screen (built in phase 3/4), it will
--    upsert by kode_dosen and — because SEED#### codes don't match any real
--    code — create 17 *new* lecturer rows rather than filling in these
--    placeholders. PLAN.md §3.1's "matching on the de-titled name" reconciler
--    for exactly this situation was not built (only exact-key upsert was).
--    Reconciling will currently mean manually re-pointing schedule_lecturers
--    rows from a SEED#### code to the newly-imported real one, or building
--    that name-matching import path first.
--
-- 2. Filsafat's listed end time (15.31 instead of a formula-clean 15.30) is
--    kept verbatim — PLAN.md §7 point 1 is explicit that the SKS formula
--    drives only the *default* in the generator, never a validation, and a
--    schedule seed should not quietly "fix" what the source document says.
--
-- 3. Room assignments are NOT seeded onto schedule rows. The source xlsx's
--    RUANGAN LURING column is blank throughout (PLAN.md §8.1); room_id stays
--    NULL here. The four rooms named on the printed PDF (301/302/303/Lab.
--    Kom) are seeded as rows so they exist in the Ruangan picker.
--
-- 4. Four "kelas gabungan" pairs (same course, same lecturer, two kelas,
--    overlapping time — PLAN.md §7's combined-class exception) are seeded as
--    plain, unflagged rows, same as any other pair of rows. Nothing in this
--    migration is blocked by clash logic (SQL INSERT bypasses the app-level
--    guard entirely), but the app's live/save-time clash checker (phase 8)
--    does not know about the "kelas gabungan" exception — editing or
--    resaving one of these four pairs later will surface it as a dosen
--    clash. That heuristic was never built; PLAN.md describes it as a
--    "probable combined class" detector the UI should offer, not enforce.
-- ==============================================================================

-- The 2026 curriculum course catalog, all 71 rows, verbatim from docs/db matakuliah.xlsx.
INSERT INTO courses (kode_mk, nama_mk, sks, jenis_mk, smt, kurikulum) VALUES
    ('10012001', 'PANCASILA', 2, 'A', 1, '2026'),
    ('10012002', 'BAHASA INDONESIA', 2, 'A', 1, '2026'),
    ('10012003', 'KEWARGANEGARAAN', 2, 'A', 1, '2026'),
    ('10012004', 'AGAMA ISLAM', 2, 'A', 1, '2026'),
    ('10012005', 'AGAMA KRISTEN PROTESTAN', 2, 'A', 1, '2026'),
    ('10012006', 'AGAMA KATOLIK', 2, 'A', 1, '2026'),
    ('10012007', 'AGAMA HINDU', 2, 'A', 1, '2026'),
    ('10012008', 'AGAMA BUDDHA', 2, 'A', 1, '2026'),
    ('10012009', 'AGAMA KONGHUCU', 2, 'A', 1, '2026'),
    ('10012010', 'KEPERCAYAAN', 2, 'A', 1, '2026'),
    ('15111001', 'SEJARAH ALIRAN PSIKOLOGI', 2, 'A', 1, '2026'),
    ('15112003', 'PENULISAN ILMIAH', 2, 'A', 1, '2026'),
    ('15112004', 'PENGEMBANGAN DIRI DAN KARIER', 2, 'A', 1, '2026'),
    ('15113002', 'FILSAFAT', 3, 'A', 1, '2026'),
    ('15113005', 'STATISTIKA I', 3, 'A', 1, '2026'),
    ('15122001', 'ENGLISH FOR ACADEMIC PURPOSES', 2, 'A', 2, '2026'),
    ('15122002', 'PSIKOLOGI PERKEMBANGAN I', 2, 'A', 2, '2026'),
    ('15122005', 'PSIKOLOGI KEPRIBADIAN I', 2, 'A', 2, '2026'),
    ('15122007', 'KODE ETIK PSIKOLOGI', 2, 'A', 2, '2026'),
    ('15123003', 'BIOPSIKOLOGI', 3, 'A', 2, '2026'),
    ('15123004', 'PSIKOLOGI UMUM', 3, 'A', 2, '2026'),
    ('15123006', 'PSIKOLOGI PENDIDIKAN', 3, 'A', 2, '2026'),
    ('15123008', 'STATISTIKA II', 3, 'A', 2, '2026'),
    ('15132002', 'PSIKOLOGI KOGNITIF', 2, 'A', 3, '2026'),
    ('15132003', 'PSIKOLOGI BELAJAR', 2, 'A', 3, '2026'),
    ('15132005', 'PSIKOLOGI KEPRIBADIAN II', 2, 'A', 3, '2026'),
    ('15132006', 'PSIKOLOGI KLINIS', 2, 'A', 3, '2026'),
    ('15132009', 'PSIKOLOGI KOMUNIKASI (P)', 2, 'B', 3, '2026'),
    ('15132010', 'CYBERPSYCHOLOGY (P)', 2, 'B', 3, '2026'),
    ('15132011', 'STATISTIKA LANJUT (P)', 2, 'B', 3, '2026'),
    ('15133004', 'PENGANTAR TES PSIKOLOGI', 3, 'A', 3, '2026'),
    ('15133007', 'PSIKOLOGI PERKEMBANGAN II', 3, 'A', 3, '2026'),
    ('15133008', 'PSIKOLOGI SOSIAL', 3, 'A', 3, '2026'),
    ('15134001', 'METODOLOGI PENELITIAN', 4, 'A', 3, '2026'),
    ('15142001', 'METODOLOGI PENELITIAN EKSPERIMEN', 2, 'A', 4, '2026'),
    ('15142002', 'METODE OBSERVASI', 2, 'A', 4, '2026'),
    ('15142008', 'DINAMIKA KELOMPOK', 2, 'A', 4, '2026'),
    ('15143003', 'METODE WAWANCARA', 3, 'A', 4, '2026'),
    ('15143004', 'PSIKOLOGI ABNORMAL', 3, 'A', 4, '2026'),
    ('15143005', 'PSIKOLOGI BISNIS I', 3, 'A', 4, '2026'),
    ('15143006', 'PSIKOMETRI', 3, 'A', 4, '2026'),
    ('15143007', 'PSIKOLOGI INDUSTRI DAN ORGANISASI', 3, 'A', 4, '2026'),
    ('15143009', 'ASESMEN BAKAT DAN INTELIGENSI', 3, 'A', 4, '2026'),
    ('15152002', 'KEWIRAUSAHAAN', 2, 'A', 5, '2026'),
    ('15152003', 'KEPANCASILAAN', 2, 'A', 5, '2026'),
    ('15152007', 'ENGLISH FOR OCCUPATIONAL PURPOSES', 2, 'A', 5, '2026'),
    ('15152008', 'PSIKOLOGI SEKOLAH', 2, 'A', 5, '2026'),
    ('15152009', 'PSIKOLOGI KESEHATAN', 2, 'A', 5, '2026'),
    ('15152010', 'PSIKOLOGI FORENSIK (P)', 2, 'B', 5, '2026'),
    ('15152011', 'PSIKOLOGI LINGKUNGAN (P)', 2, 'B', 5, '2026'),
    ('15152012', 'MSDM BERBASIS KOMPETENSI (P)', 2, 'B', 5, '2026'),
    ('15152013', 'PSIKOLOGI KOMUNITAS (P)', 2, 'B', 5, '2026'),
    ('15152014', 'PSIKOLOGI REMAJA (P)', 2, 'B', 5, '2026'),
    ('15153001', 'METODE KONSTRUKSI ALAT UKUR', 3, 'A', 5, '2026'),
    ('15153004', 'ASESMEN KEPRIBADIAN', 3, 'A', 5, '2026'),
    ('15153005', 'METODOLOGI PENELITIAN KUALITATIF', 3, 'A', 5, '2026'),
    ('15153006', 'PSIKOLOGI BISNIS II', 3, 'A', 5, '2026'),
    ('15162002', 'PELATIHAN', 2, 'A', 6, '2026'),
    ('15162004', 'MODIFIKASI PERILAKU', 2, 'A', 6, '2026'),
    ('15162008', 'METODE ASSESSMENT CENTER', 2, 'A', 6, '2026'),
    ('15162009', 'PSIKOLOGI BENCANA (P)', 2, 'B', 6, '2026'),
    ('15162010', 'PSIKOLOGI PERILAKU SEKSUAL (P)', 2, 'B', 6, '2026'),
    ('15162011', 'PSIKOLOGI PERKAWINAN (P)', 2, 'B', 6, '2026'),
    ('15162012', 'DATA SCIENCE AND INFORMATION TECHNOLOGY (P)', 2, 'B', 6, '2026'),
    ('15163003', 'INTERVENSI SOSIAL', 3, 'A', 6, '2026'),
    ('15163005', 'PSIKOLOGI KONSUMEN DAN PERILAKU EKONOMI', 3, 'A', 6, '2026'),
    ('15163006', 'PSIKOLOGI KONSELING', 3, 'A', 6, '2026'),
    ('15163007', 'PSIKOLOGI LINTAS BUDAYA', 3, 'A', 6, '2026'),
    ('15164001', 'PENULISAN PROPOSAL PENELITIAN', 4, 'A', 6, '2026'),
    ('15174001', 'MAGANG', 4, 'A', 7, '2026'),
    ('15186001', 'SKRIPSI', 6, 'A', 8, '2026')
ON CONFLICT (kode_mk) DO NOTHING;

-- Rooms mentioned on the printed schedule (docs/*_REGULER_*.pdf); the source
-- xlsx itself has a blank RUANGAN LURING column throughout (PLAN.md §8.1),
-- so schedule rows below are seeded with room_id left NULL.
INSERT INTO rooms (nama, kapasitas) VALUES ('301', 0), ('302', 0), ('303', 0), ('Lab. Kom', 0)
ON CONFLICT (nama) DO NOTHING;

-- Seed lecturers harvested from the 2026/2027 Gasal schedule sheets.
-- Real kode_dosen/NIDN come from docs/db dosen.xlsx where the name matches;
-- everyone else gets a synthetic SEED#### code (see migration header).
INSERT INTO lecturers (kode_dosen, nidn, gelar_depan, nama, gelar_belakang) VALUES
    ('6006211001', '0311106301', 'Dr.', 'Silverius Y Soeharso', ', SPsi., SE., MM, M.Psi., Psikolog'),
    ('6007211002', '0305107104', 'Dr.', 'Evanytha', ', M.Si., Psikolog'),
    ('6009230025', '0303077704', 'Dr.', 'Seta Ariawuri Wicaksana', ', S.Psi., M.Psi., M.M., Psikolog'),
    ('6016231002', '0315106603', 'Dr.', 'ENDANG MARIANI RAHAYU', ', S.Sos., M.Psi'),
    ('SEED0001', NULL, '', 'A. Eka Septilla AM', ', S.Psi., M.Psi., Psikolog'),
    ('SEED0002', NULL, '', 'Aisyah', ', M.Si'),
    ('SEED0003', NULL, '', 'Andri Setia Dharma', ', M.Psi., Psikolog'),
    ('SEED0004', NULL, '', 'Anindya Dewi Paramita', ', S.Psi., M.Psi., Psikolog'),
    ('SEED0005', NULL, '', 'Aully Grashinta', ', M.Si., Psikolog'),
    ('SEED0006', NULL, '', 'Bobby Suwandi', ', M.Psi'),
    ('SEED0007', NULL, 'Dr.', 'Ayu Dwi Nindyati', ', M.Si., Psikolog'),
    ('SEED0008', NULL, 'Dr.', 'Bimo Wikantyoso', ', M.Psi., Psikolog'),
    ('SEED0009', NULL, 'Dr.', 'M. Akhyar', ', M.Si'),
    ('SEED0010', NULL, 'Dr.', 'Vinaya', ', M.Si'),
    ('SEED0011', NULL, '', 'Endro Puspo Wiroko', ', M.Psi., Psikolog'),
    ('SEED0012', NULL, '', 'Farida Aini', ', M.Psi., Psikolog'),
    ('SEED0013', NULL, '', 'M. Ramadhana R', ', M.Si., M.Psi., Psikolog'),
    ('SEED0014', NULL, '', 'Maharani Ardi Putri', ', M.Si., Psikolog'),
    ('SEED0015', NULL, '', 'Ni Made Rai Kistyanti', ', S.Psi., M.Psi., Psikolog'),
    ('SEED0016', NULL, 'Prof.', 'Awaluddin Tjalla', ', M.Pd., M.Psi'),
    ('SEED0017', NULL, '', 'Sofia Fitri Rahmani', ', M.Pd')
ON CONFLICT (kode_dosen) DO NOTHING;

-- Seed the 96 schedule rows for 2026/2027 Gasal.
DO $$
DECLARE
  v_schedule_id UUID;
BEGIN
  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '15112004', 'A', 'SELASA', '07:30', '09:10', 37, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0015', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '15111001', 'A', 'RABU', '07:30', '09:10', 37, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, '6009230025', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '15113005', 'A', 'RABU', '13:00', '15:30', 37, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0003', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '15112003', 'A', 'KAMIS', '09:20', '11:00', 37, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0002', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '15113002', 'A', 'KAMIS', '13:00', '15:31', 37, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, '6007211002', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '10012001', 'A', 'JUMAT', '07:30', '09:10', 0, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '10012002', 'A', 'JUMAT', '09:20', '11:00', 0, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '10012003', 'A', 'JUMAT', '13:00', '14:40', 0, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '10012004', 'A', 'JUMAT', '14:50', '16:30', 0, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '15113002', 'B', 'SENIN', '13:00', '15:30', 37, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, '6007211002', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '15112004', 'B', 'SELASA', '09:20', '11:00', 37, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0004', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '15113005', 'B', 'RABU', '09:20', '11:50', 37, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0003', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '15111001', 'B', 'KAMIS', '07:30', '09:10', 37, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0001', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '15112003', 'B', 'KAMIS', '13:00', '14:40', 37, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0002', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '10012001', 'B', 'JUMAT', '07:30', '09:10', 0, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '10012002', 'B', 'JUMAT', '09:20', '11:00', 0, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '10012003', 'B', 'JUMAT', '13:00', '14:40', 0, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '10012004', 'B', 'JUMAT', '14:50', '16:30', 0, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '15113002', 'C', 'SENIN', '09:20', '11:50', 39, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0009', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '15111001', 'C', 'RABU', '09:20', '11:00', 39, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, '6009230025', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '15112004', 'C', 'KAMIS', '09:20', '11:00', 39, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0015', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '15113005', 'C', 'KAMIS', '13:00', '15:30', 39, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0003', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '15112003', 'C', 'JUMAT', '13:00', '14:40', 39, 'setiap', true, 'bentrok pada data sumber 2026/2027')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0002', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '10012001', 'C', 'JUMAT', '07:30', '09:10', 0, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '10012002', 'C', 'JUMAT', '09:20', '11:00', 0, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '10012003', 'C', 'JUMAT', '13:00', '14:40', 0, 'setiap', true, 'bentrok pada data sumber 2026/2027')
  RETURNING id INTO v_schedule_id;

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 1, '10012004', 'C', 'JUMAT', '14:50', '16:30', 0, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15132005', 'A', 'SENIN', '07:30', '09:10', 30, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0014', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15133008', 'A', 'SENIN', '13:00', '16:10', 29, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0009', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15123006', 'A', 'SELASA', '07:30', '10:00', 28, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0012', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15142001', 'A', 'SELASA', '10:30', '12:10', 30, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0008', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15143007', 'A', 'RABU', '07:30', '10:00', 27, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0007', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15132006', 'A', 'RABU', '10:10', '12:40', 28, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0001', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15152009', 'A', 'KAMIS', '10:10', '11:30', 28, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0004', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15133004', 'A', 'KAMIS', '07:30', '10:00', 28, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0011', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15152014', 'A', 'SELASA', '15:40', '17:10', 5, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0013', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15162010', 'A', 'SENIN', '10:30', '12:10', 23, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0014', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15133004', 'B', 'SENIN', '07:30', '10:00', 24, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0011', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15123006', 'B', 'SENIN', '13:00', '15:30', 25, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0016', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15143007', 'B', 'SELASA', '13:30', '15:10', 24, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0007', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15133008', 'B', 'SELASA', '07:30', '10:40', 25, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0010', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15142001', 'B', 'RABU', '07:30', '09:10', 25, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0008', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15132005', 'B', 'RABU', '10:10', '11:40', 35, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, '6007211002', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15132006', 'B', 'RABU', '13:30', '15:10', 25, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0001', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15152009', 'B', 'KAMIS', '13:00', '14:30', 24, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0004', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15152014', 'B', 'SELASA', '15:20', '16:50', 5, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0013', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 3, '15162010', 'B', 'SENIN', '10:30', '12:10', 26, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0014', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15162002', 'A', 'SENIN', '07:30', '09:10', 31, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0005', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15152003', 'A', 'SENIN', '10:30', '12:10', 31, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0013', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15143009', 'A', 'SELASA', '07:30', '10:00', 31, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0005', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15153001', 'A', 'SELASA', '10:10', '12:40', 30, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0006', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15143005', 'A', 'RABU', '07:30', '10:00', 31, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, '6006211001', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15152008', 'A', 'RABU', '10:30', '12:00', 30, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0005', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15152002', 'A', 'KAMIS', '07:30', '09:10', 29, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, '6006211001', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15152007', 'A', 'JUMAT', '07:30', '09:10', 31, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0017', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15152010', 'A', 'JUMAT', '13:00', '14:40', 27, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0014', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15152012', 'A', 'KAMIS', '14:50', '16:30', 10, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, '6009230025', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15153001', 'B', 'SENIN', '07:30', '10:00', 30, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0006', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15152008', 'B', 'SENIN', '13:00', '14:40', 29, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0012', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15152003', 'B', 'SELASA', '07:30', '10:00', 30, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0013', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15162002', 'B', 'SELASA', '10:30', '12:10', 29, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0005', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15143009', 'B', 'RABU', '07:30', '10:00', 30, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0005', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15143005', 'B', 'KAMIS', '10:00', '12:30', 29, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, '6006211001', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15152007', 'B', 'JUMAT', '09:20', '11:00', 29, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0017', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15152002', 'B', 'JUMAT', '07:30', '09:10', 29, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0008', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15152010', 'B', 'JUMAT', '13:00', '14:40', 27, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0014', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'reguler', 5, '15152012', 'B', 'KAMIS', '14:50', '16:30', 13, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, '6009230025', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 1, '15112003', 'A', 'SENIN', '18:00', '19:40', 5, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0002', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 1, '15111001', 'A', 'SENIN', '19:50', '21:30', 5, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, '6009230025', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 1, '10012004', 'A', 'SELASA', '18:00', '19:40', 0, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 1, '15112004', 'A', 'JUMAT', '19:50', '21:30', 5, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0015', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 1, '10012003', 'A', 'RABU', '19:50', '21:30', 0, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 1, '10012002', 'A', 'KAMIS', '18:00', '19:40', 0, 'setiap', true, 'bentrok pada data sumber 2026/2027')
  RETURNING id INTO v_schedule_id;

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 1, '10012001', 'A', 'KAMIS', '19:50', '21:30', 0, 'setiap', true, 'bentrok pada data sumber 2026/2027')
  RETURNING id INTO v_schedule_id;

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 1, '15113002', 'A', 'KAMIS', '18:00', '20:30', 5, 'setiap', true, 'bentrok pada data sumber 2026/2027')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0009', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 1, '15113005', 'A', 'SABTU', '09:20', '11:50', 5, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0003', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 3, '15123006', 'A', 'SENIN', '18:00', '20:30', 4, 'setiap', true, 'bentrok pada data sumber 2026/2027')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0012', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 3, '15143007', 'A', 'SELASA', '18:00', '20:30', 4, 'genap', true, 'bentrok pada data sumber 2026/2027')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0007', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 3, '15133008', 'A', 'KAMIS', '18:00', '21:30', 4, 'ganjil', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0010', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 3, '15142001', 'A', 'KAMIS', '18:00', '19:40', 4, 'genap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0010', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 3, '15152009', 'A', 'JUMAT', '18:00', '19:40', 4, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0015', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 3, '15132005', 'A', 'RABU', '19:50', '21:30', 4, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0014', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 3, '15132006', 'A', 'SABTU', '10:00', '12:40', 5, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0001', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 3, '15133004', 'A', 'SABTU', '13:30', '16:00', 4, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0011', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 3, '15162010', 'A', 'SELASA', '18:00', '19:40', 4, 'genap', true, 'bentrok pada data sumber 2026/2027')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0015', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 3, '15152014', 'A', 'SENIN', '19:50', '21:30', 4, 'setiap', true, 'bentrok pada data sumber 2026/2027')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0013', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 5, '15152003', 'A', 'SENIN', '18:00', '19:40', 4, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0013', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 5, '15162002', 'A', 'SENIN', '19:50', '21:30', 4, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0011', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 5, '15143009', 'A', 'SELASA', '18:00', '20:30', 4, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0004', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 5, '15152010', 'A', 'RABU', '18:00', '19:40', 4, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0014', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 5, '15152007', 'A', 'RABU', '19:50', '21:30', 4, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0017', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 5, '15143005', 'A', 'KAMIS', '18:00', '20:30', 4, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, '6006211001', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 5, '15152008', 'A', 'JUMAT', '18:00', '19:40', 4, 'ganjil', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0012', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 5, '15152002', 'A', 'JUMAT', '19:50', '21:30', 4, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0008', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 5, '15153001', 'A', 'SABTU', '10:00', '12:40', 4, 'setiap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0006', 1);

  INSERT INTO schedules (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas, hari, jam_mulai, jam_selesai, jumlah_mhs, minggu, is_override, override_reason)
  VALUES ('20261', 'regsus', 5, '15152012', 'A', 'JUMAT', '18:00', '19:40', 4, 'genap', false, '')
  RETURNING id INTO v_schedule_id;
  INSERT INTO schedule_lecturers (schedule_id, kode_dosen, urutan) VALUES (v_schedule_id, 'SEED0008', 1);

END $$;
-- ==============================================================================
-- Migration: 20260922000003_grant_authenticated_privileges.sql
-- Description: Grant table-level privileges to the `authenticated` role.
--
-- RLS policies (20260921000002) only filter which ROWS a query can see —
-- they don't grant access to the table itself. Without this GRANT, Postgres
-- blocks every query for `authenticated` before RLS is even evaluated:
-- "permission denied for table X" (Postgres error 42501), regardless of how
-- permissive the RLS policy is. Confirmed live: an authenticated session
-- returned 42501 on `courses` even though the "allow authenticated full
-- access" policy exists and the table has rows.
-- ==============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
