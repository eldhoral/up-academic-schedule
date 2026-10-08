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
-- 6. Adds the login-photos bucket, user roles (profiles) and the audit log
-- 7. Creates the UTS/UAS (exams) and prasidang/sidang (defenses) tables, and seeds
--    the 2025/2026 Gasal UTS and defense schedules
-- 8. Creates the mahasiswa master (students), seeded from those defenses
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
    hari VARCHAR(10) NOT NULL CHECK (hari IN ('SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU')),
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
    hari VARCHAR(10) NOT NULL CHECK (hari IN ('SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU')),
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
    ('header_baris', E'JADWAL KULIAH SEMESTER {semester}\nANGKATAN {angkatan}\nSEMESTER {term} TAHUN AKADEMIK {tahun}', 'text', 'cetak', 'Baris Header Cetak', 'Format teks 4 baris header lembar jadwal cetak', 7),
    ('keterangan_cetak', E'MK DENGAN BINTANG (*) ADALAH MATA KULIAH PILIHAN\nMATA KULIAH PILIHAN DIBUKA DENGAN MINIMAL MAHASISWA 10 ORANG\nKELAS GABUNGAN, MAKSIMAL 1 KELAS 50 ORANG, JIKA LEBIH DIBUKA KELAS BARU', 'text', 'cetak', 'Keterangan Cetak', 'Catatan informasi pada bagian bawah lembar jadwal cetak', 8),
    ('nama_penandatangan', 'FARIDA AINI, M.PSI., PSIKOLOG', 'text', 'cetak', 'Nama Penandatangan', 'Nama lengkap pejabat penandatangan lembar jadwal', 9),
    ('jabatan_penandatangan', 'KETUA PROGRAM STUDI', 'text', 'cetak', 'Jabatan Penandatangan', 'Jabatan resmi penandatangan jadwal', 10),
    ('gambar_tanda_tangan', '', 'image', 'cetak', 'Gambar Tanda Tangan', 'URL atau base64 gambar stempel / tanda tangan (opsional)', 11),
    ('ukuran_kertas', 'A4', 'text', 'cetak', 'Ukuran Kertas', 'Ukuran kertas pencetakan dokumen (A4 / Letter / Legal)', 12),
    ('orientasi', 'portrait', 'text', 'cetak', 'Orientasi Cetak', 'Orientasi kertas pencetakan dokumen (portrait / landscape)', 13),

    -- Surat (Surat Penugasan Pengampu Mata Kuliah / Rekap Dosen)
    ('kop_baris', E'FAKULTAS PSIKOLOGI UNIVERSITAS PANCASILA\nGedung Fakultas Psikologi\nSrengseng Sawah – Lenteng Agung, Jagakarsa Jakarta Selatan 12640\nTelp. 021 – 7872462   |   Website: http://psikologi.univpancasila.ac.id\nE-mail: psikologiup@univpancasila.ac.id', 'text', 'surat', 'Baris Kop Surat', 'Format teks kop surat (baris pertama tebal, sisanya alamat/kontak)', 1),
    ('nomor_surat', '', 'text', 'surat', 'Nomor Surat', 'Nomor surat penugasan, diperbarui setiap kali surat dibuat', 2),
    ('lampiran_surat', '', 'text', 'surat', 'Lampiran', 'Isi baris Lampiran pada surat (boleh dikosongkan)', 3),
    ('perihal_surat', 'Penugasan Pengampu Mata Kuliah', 'text', 'surat', 'Perihal', 'Isi baris Perihal pada surat', 4),
    ('catatan_perkuliahan', 'Perkuliahan telah dilaksanakan pada hari Senin, 7 September 2026. Khusus bagi mahasiswa baru, perkuliahan akan dimulai pada hari Senin, 21 September 2026.', 'text', 'surat', 'Catatan Perkuliahan', 'Paragraf catatan tanggal mulai perkuliahan, perbarui setiap semester', 5),
    ('nama_dekan', 'Prof. Dr. Awaluddin Tjalla, M.Pd., M.Psi', 'text', 'surat', 'Nama Dekan', 'Nama lengkap Dekan penandatangan surat penugasan', 6),
    ('jabatan_dekan', 'Dekan', 'text', 'surat', 'Jabatan Dekan', 'Jabatan penandatangan surat penugasan', 7),
    ('gambar_tanda_tangan_dekan', '', 'image', 'surat', 'Gambar Tanda Tangan Dekan', 'URL atau base64 gambar stempel / tanda tangan Dekan (opsional)', 8),
    ('tembusan', E'Para Wadek;\nKa. Prodi;\nKabag/Kasubbag Akademik;\nKabag Umum, Keuangan, Kepegawaian dan Aset;\nArsip.', 'text', 'surat', 'Tembusan', 'Daftar tembusan surat, satu baris per tujuan', 9)
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

-- ==============================================================================
-- Migration: 20260924000002_login_photos_bucket.sql
-- Description: Storage bucket for the login page photo carousel (Pengaturan).
-- ==============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('up_kiprat', 'up_kiprat', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read access to up_kiprat" on storage.objects;
create policy "Public read access to up_kiprat"
    on storage.objects for select
    to public
    using (bucket_id = 'up_kiprat');

drop policy if exists "Authenticated users can upload to up_kiprat" on storage.objects;
create policy "Authenticated users can upload to up_kiprat"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'up_kiprat');

drop policy if exists "Authenticated users can update up_kiprat" on storage.objects;
create policy "Authenticated users can update up_kiprat"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'up_kiprat')
    with check (bucket_id = 'up_kiprat');

drop policy if exists "Authenticated users can delete from up_kiprat" on storage.objects;
create policy "Authenticated users can delete from up_kiprat"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'up_kiprat');

-- ==============================================================================
-- Migration: 20260924000003_user_roles.sql
-- Description: User roles (SUPERADMIN, SCHEDULER, VIEWER) via a `profiles`
-- table keyed to auth.users, plus role-aware RLS.
-- ==============================================================================

create table if not exists profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    role text not null default 'VIEWER' check (role in ('SUPERADMIN', 'SCHEDULER', 'VIEWER')),
    created_at timestamptz not null default timezone('utc'::text, now())
);

alter table profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on profiles;
create policy "profiles_select_authenticated"
    on profiles for select
    to authenticated
    using (true);

grant select on profiles to authenticated;

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

insert into profiles (id, email, role)
select id, email, 'SUPERADMIN' from auth.users
on conflict (id) do nothing;

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

do $$
declare
    t text;
begin
    foreach t in array array[
        'academic_years', 'courses', 'lecturers', 'rooms',
        'sessions', 'schedules', 'schedule_lecturers', 'settings'
    ]
    loop
        execute format('drop policy if exists %I on %I', 'Allow authenticated users full access to ' || t, t);

        execute format('drop policy if exists %I on %I', t || '_select', t);
        execute format(
            'create policy %I on %I for select to authenticated using (true)',
            t || '_select', t
        );

        execute format('drop policy if exists %I on %I', t || '_insert', t);
        execute format(
            'create policy %I on %I for insert to authenticated with check (is_scheduler_or_above())',
            t || '_insert', t
        );

        execute format('drop policy if exists %I on %I', t || '_update', t);
        execute format(
            'create policy %I on %I for update to authenticated using (is_scheduler_or_above()) with check (is_scheduler_or_above())',
            t || '_update', t
        );

        execute format('drop policy if exists %I on %I', t || '_delete', t);
        execute format(
            'create policy %I on %I for delete to authenticated using (is_scheduler_or_above())',
            t || '_delete', t
        );
    end loop;
end $$;

-- ==============================================================================
-- Migration: 20260924000004_grant_service_role_profiles.sql
-- Description: service_role needs the table-level GRANT on profiles too —
-- RLS bypass doesn't imply privilege.
-- ==============================================================================

grant select, insert, update, delete on profiles to service_role;

-- ==============================================================================
-- Migration: 20260924000005_audit_log.sql
-- Description: Generic audit trail — one trigger function attached to every
-- data table, logging who changed what and the before/after row.
-- ==============================================================================

create table if not exists audit_log (
    id bigint generated always as identity primary key,
    at timestamptz not null default timezone('utc'::text, now()),
    actor_id uuid references auth.users(id) on delete set null,
    actor_email text,
    action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
    table_name text not null,
    record_id text,
    old_data jsonb,
    new_data jsonb
);

create index if not exists idx_audit_log_at on audit_log (at desc);
create index if not exists idx_audit_log_table on audit_log (table_name);
create index if not exists idx_audit_log_actor on audit_log (actor_id);

alter table audit_log enable row level security;

drop policy if exists "audit_log_select_authenticated" on audit_log;
create policy "audit_log_select_authenticated"
    on audit_log for select
    to authenticated
    using (true);

grant select on audit_log to authenticated;

create or replace function audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    old_j jsonb := case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) else null end;
    new_j jsonb := case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(NEW) else null end;
    rid text := coalesce(
        new_j ->> 'id', old_j ->> 'id',
        new_j ->> 'kode_mk', old_j ->> 'kode_mk',
        new_j ->> 'kode_dosen', old_j ->> 'kode_dosen',
        new_j ->> 'key', old_j ->> 'key'
    );
    actor uuid := auth.uid();
    actor_mail text;
begin
    if actor is not null then
        select email into actor_mail from auth.users where id = actor;
    end if;

    insert into audit_log (actor_id, actor_email, action, table_name, record_id, old_data, new_data)
    values (actor, actor_mail, TG_OP, TG_TABLE_NAME, rid, old_j, new_j);

    return coalesce(NEW, OLD);
end;
$$;

do $$
declare
    t text;
begin
    foreach t in array array[
        'academic_years', 'courses', 'lecturers', 'rooms', 'sessions',
        'schedules', 'schedule_lecturers', 'settings', 'profiles'
    ]
    loop
        execute format('drop trigger if exists audit_%I on %I', t, t);
        execute format(
            'create trigger audit_%I after insert or update or delete on %I for each row execute function audit_row()',
            t, t
        );
    end loop;
end $$;

-- ==============================================================================
-- Migration: 20260924000006_audit_log_auth_events.sql
-- Description: Allow LOGIN/LOGOUT actions in audit_log for sign-in/out events.
-- ==============================================================================

alter table audit_log drop constraint if exists audit_log_action_check;
alter table audit_log add constraint audit_log_action_check
    check (action in ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'));

-- ==============================================================================
-- Migration: 20260924000007_audit_log_retention.sql
-- Description: Nightly purge of audit_log entries older than 1 month.
-- ==============================================================================

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
    null;
end $$;

select cron.schedule('purge_old_audit_log', '0 3 * * *', 'select purge_old_audit_log()');

-- ==============================================================================
-- Migration: 20260924000010_grant_service_role_audit_log.sql
-- Description: Let the service-role client insert LOGIN/LOGOUT entries.
-- ==============================================================================

grant select, insert on audit_log to service_role;

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

-- ==============================================================================
-- Migration: 20261002000003_seed_ujian_2025_2026_gasal.sql
-- Description: Seed the UTS (ETS) schedule of 2025/2026 Gasal, Reguler.
--
-- Source: docs/KONSEP JADWAL ETS GASAL 25-26 + PENGAWAS.xlsx, sheet "Reguler" (semesters
-- I, III and V). Requires 20261002000001_exams.sql. 67 rows. Idempotent: rows that
-- already exist (same year, UTS, program, semester, mata kuliah and kelas) are left alone.
--
-- Generated by a one-off Node script (not checked in) that parsed the sheet, mapped every course to its
-- 2026 kode_mk (PLAN.md §7b; semester I by name) and matched dosen by name. Decisions, on purpose:
--
-- 1. The year 2025/2026 Gasal (20251) is created, NOT active; the app's active year stays 2026/2027.
--    There is no 2025/2026 kuliah schedule, so the DOSEN PENGAMPU column of these exams prints blank
--    and each row shows the "tidak ada lagi di jadwal kuliah" mark until one is entered.
-- 2. The 10 university-run (MKWU) courses have the date 21/10/2025 in the sheet but "UNIVERSITAS"
--    instead of an hour, and an exam is dated only together with its hour, so they are seeded without
--    a date (they list under "Belum dijadwalkan") as one GABUNGAN row each.
-- 3. DASAR-DASAR PSIKOTERAPI (60421011, "semester IV ke atas non kelas") is not in the 2026 course
--    catalog, so it is not seeded. Rows whose course is missing from the live catalog are skipped.
-- 4. Rooms 201 and 202 are added (the sheet uses them; the catalog had 301, 302, 303 and Lab. Kom).
-- 5. A pengawas is the matched dosen, else the name as free text; AKADEMIK stays free text. Dosen who
--    are not in the dosen master as of seeding (JUNI ARATIKA) are free text. Biopsikologi kelas B has no
--    pengawas in the sheet.
-- 6. One keterangan per mata kuliah: the first one the sheet gives (Psikologi Sosial is OFFLINE UJIAN
--    LISAN for both kelas; the sheet leaves kelas B's blank).
-- 7. The hidden sheet "GABUNGAN" (2022/2023 Reguler Khusus, an older concept) is not seeded.
-- The sheet has no clashes between pengawas, rooms or kelas (checked with the app's own rules).
-- ==============================================================================

INSERT INTO academic_years (id, label, is_active)
VALUES ('20251', '2025/2026 Gasal', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO rooms (nama, kapasitas) VALUES ('201', 0), ('202', 0)
ON CONFLICT (nama) DO NOTHING;

-- Match each source dosen to the dosen master by name tokens. A key resolves only when exactly one
-- lecturer matches; otherwise it stays NULL (a defense role is left empty, a pengawas falls back to
-- the name as free text). Temp tables, dropped at the end.
CREATE TEMP TABLE _dosen_src (src text PRIMARY KEY, t1 text NOT NULL, t2 text NOT NULL);
INSERT INTO _dosen_src (src, t1, t2) VALUES
    ('aisyah', 'aisyah', 'aisyah'),
    ('akhyar', 'akhyar', 'akhyar'),
    ('anindya', 'anindya', 'anindya'),
    ('dharma', 'dharma', 'dharma'),
    ('evanytha', 'evanytha', 'evanytha'),
    ('farida_aini', 'farida', 'aini'),
    ('grashinta', 'grashinta', 'grashinta'),
    ('kistyanti', 'kistyanti', 'kistyanti'),
    ('maharani', 'maharani', 'maharani'),
    ('rahmani', 'rahmani', 'rahmani'),
    ('ramadhana', 'ramadhana', 'ramadhana'),
    ('septilla', 'septilla', 'septilla'),
    ('seta', 'seta', 'wicaksana'),
    ('vinaya', 'vinaya', 'vinaya'),
    ('wiroko', 'wiroko', 'wiroko');

CREATE TEMP TABLE _dosen AS
SELECT s.src, CASE WHEN count(l.kode_dosen) = 1 THEN min(l.kode_dosen) END AS kode
FROM _dosen_src s
LEFT JOIN lecturers l ON lower(l.nama) LIKE '%' || s.t1 || '%' AND lower(l.nama) LIKE '%' || s.t2 || '%'
GROUP BY s.src;

INSERT INTO exams (academic_year_id, jenis_ujian, jenis_kelas, semester_ke, kode_mk, kelas, tanggal, jam_mulai, jam_selesai, room_id, pengawas, keterangan_ujian)
SELECT
    '20251', 'uts', 'reguler', v.smt, v.kode, v.kelas, v.tanggal::date, v.mulai::time, v.selesai::time,
    (SELECT r.id FROM rooms r WHERE r.nama = v.room),
    (SELECT COALESCE(jsonb_agg(
                CASE WHEN d.kode IS NOT NULL THEN jsonb_build_object('kode_dosen', d.kode) ELSE jsonb_build_object('nama', t.e ->> 'n') END
                ORDER BY t.o), '[]'::jsonb)
       FROM jsonb_array_elements(v.pengawas::jsonb) WITH ORDINALITY AS t(e, o)
       LEFT JOIN _dosen d ON d.src = t.e ->> 'k'),
    v.ket
FROM (VALUES
    (1, '10012001', 'GABUNGAN', NULL, NULL, NULL, NULL, '[]', 'offline'),
    (1, '10012003', 'GABUNGAN', NULL, NULL, NULL, NULL, '[]', 'offline'),
    (1, '10012004', 'GABUNGAN', NULL, NULL, NULL, NULL, '[]', 'offline'),
    (1, '10012005', 'GABUNGAN', NULL, NULL, NULL, NULL, '[]', 'offline'),
    (1, '10012006', 'GABUNGAN', NULL, NULL, NULL, NULL, '[]', 'offline'),
    (1, '10012007', 'GABUNGAN', NULL, NULL, NULL, NULL, '[]', 'offline'),
    (1, '10012008', 'GABUNGAN', NULL, NULL, NULL, NULL, '[]', 'offline'),
    (1, '10012009', 'GABUNGAN', NULL, NULL, NULL, NULL, '[]', 'offline'),
    (1, '10012010', 'GABUNGAN', NULL, NULL, NULL, NULL, '[]', 'offline'),
    (1, '10012002', 'GABUNGAN', NULL, NULL, NULL, NULL, '[]', 'offline'),
    (1, '15113002', 'A', '2025-10-27', '08:00', '10:00', '201', '[{"k":"evanytha","n":"DR. EVANYTHA, M.SI., PSIKOLOG"}]', 'offline'),
    (1, '15113002', 'B', '2025-10-27', '08:00', '10:00', '202', '[{"k":"anindya","n":"ANINDYA DEWI PARAMITA, M.PSI., PSIKOLOG"}]', 'offline'),
    (1, '15123004', 'A', '2025-10-29', '08:00', '10:00', '201', '[{"k":"maharani","n":"MAHARANI ARDI PUTRI, M.SI., PSIKOLOG"}]', 'offline'),
    (1, '15123004', 'B', '2025-10-29', '08:00', '10:00', '202', '[{"k":"anindya","n":"ANINDYA DEWI PARAMITA, M.PSI., PSIKOLOG"}]', 'offline'),
    (1, '15123003', 'A', '2025-10-29', '11:00', '13:00', '301', '[{"k":"aisyah","n":"AISYAH, M.SI"}]', 'offline'),
    (1, '15123003', 'B', '2025-10-29', '11:00', '13:00', '302', '[]', 'offline'),
    (1, '15112004', 'A', '2025-10-30', '08:00', '10:00', NULL, '[{"n":"AKADEMIK"}]', 'take_home'),
    (1, '15112004', 'B', '2025-10-30', '08:00', '10:00', NULL, '[{"n":"AKADEMIK"}]', 'take_home'),
    (1, '15113005', 'A', '2025-10-31', '08:00', '10:00', '201', '[{"k":"dharma","n":"ANDRI SETIA DHARMA, M.PSI., PSIKOLOG"}]', 'offline'),
    (1, '15113005', 'B', '2025-10-31', '08:00', '10:00', '202', '[{"k":"kistyanti","n":"NI MADE RAI KISTYANTI, M.PSI., PSIKOLOG"}]', 'offline'),
    (3, '15132006', 'A', '2025-10-27', '08:00', '10:00', NULL, '[{"n":"AKADEMIK"}]', 'take_home'),
    (3, '15132006', 'B', '2025-10-27', '08:00', '10:00', NULL, '[{"n":"AKADEMIK"}]', 'take_home'),
    (3, '15142001', 'A', '2025-10-27', '11:00', '13:00', NULL, '[{"n":"AKADEMIK"}]', 'take_home'),
    (3, '15142001', 'B', '2025-10-27', '11:00', '13:00', NULL, '[{"n":"AKADEMIK"}]', 'take_home'),
    (3, '15123006', 'A', '2025-10-28', '08:00', '10:00', '201', '[{"k":"farida_aini","n":"FARIDA AINI, M.PSI., PSIKOLOG"}]', 'offline'),
    (3, '15123006', 'B', '2025-10-28', '08:00', '10:00', '202', '[{"k":"grashinta","n":"AULLY GRASHINTA, M.SI., PSIKOLOG"}]', 'offline'),
    (3, '15152009', 'A', '2025-10-28', '11:00', '13:00', '201', '[{"k":"kistyanti","n":"NI MADE RAI KISTYANTI, M.PSI., PSIKOLOG"}]', 'offline'),
    (3, '15152009', 'B', '2025-10-28', '11:00', '13:00', '202', '[{"k":"ramadhana","n":"M. RAMADHANA, M.SI"}]', 'offline'),
    (3, '15133004', 'A', '2025-10-29', '08:00', '10:00', NULL, '[{"n":"AKADEMIK"}]', 'online'),
    (3, '15133004', 'B', '2025-10-29', '08:00', '10:00', NULL, '[{"n":"AKADEMIK"}]', 'online'),
    (3, '15152014', 'A', '2025-10-29', '14:00', '16:00', NULL, '[{"n":"AKADEMIK"}]', 'take_home'),
    (3, '15152014', 'B', '2025-10-29', '14:00', '16:00', NULL, '[{"n":"AKADEMIK"}]', 'take_home'),
    (3, '15132005', 'A', '2025-10-30', '08:00', '10:00', '201', '[{"k":"evanytha","n":"DR. EVANYTHA, M.SI., PSIKOLOG"}]', 'offline'),
    (3, '15132005', 'B', '2025-10-30', '08:00', '10:00', '202', '[{"k":"kistyanti","n":"NI MADE RAI KISTYANTI, M.PSI., PSIKOLOG"}]', 'offline'),
    (3, '15162010', 'GABUNGAN', '2025-10-30', '11:00', '13:00', NULL, '[{"n":"AKADEMIK"}]', 'take_home'),
    (3, '15133008', 'A', '2025-10-31', '08:00', '10:00', '302', '[{"k":"akhyar","n":"MUHAMMAD AKHYAR, M.SI"}]', 'ujian_lisan'),
    (3, '15133008', 'B', '2025-10-31', '08:00', '10:00', '303', '[{"k":"vinaya","n":"DR. VINAYA, M.SI"}]', 'ujian_lisan'),
    (3, '15143007', 'A', '2025-10-31', '13:00', '15:00', NULL, '[{"n":"AKADEMIK"}]', 'take_home'),
    (3, '15143007', 'B', '2025-10-31', '13:00', '15:00', NULL, '[{"n":"AKADEMIK"}]', 'take_home'),
    (5, '15152002', 'A', '2025-10-27', '08:00', '10:00', NULL, '[{"n":"AKADEMIK"}]', 'take_home'),
    (5, '15152002', 'B', '2025-10-27', '08:00', '10:00', NULL, '[{"n":"AKADEMIK"}]', 'take_home'),
    (5, '15152002', 'C', '2025-10-27', '08:00', '10:00', NULL, '[{"n":"AKADEMIK"}]', 'take_home'),
    (5, '15152010', 'GABUNGAN', '2025-10-27', '11:00', '13:00', NULL, '[{"n":"AKADEMIK"}]', 'online'),
    (5, '15152012', 'GABUNGAN', '2025-10-27', '14:00', '16:00', NULL, '[{"n":"AKADEMIK"}]', 'take_home'),
    (5, '15143005', 'A', '2025-10-28', '08:00', '10:00', '301', '[{"k":"anindya","n":"ANINDYA DEWI PARAMITA, M.PSI., PSIKOLOG"}]', 'offline'),
    (5, '15143005', 'B', '2025-10-28', '08:00', '10:00', '302', '[{"k":"wiroko","n":"ENDRO PUSPO WIROKO, M.PSI., PSIKOLOG"}]', 'offline'),
    (5, '15143005', 'C', '2025-10-28', '08:00', '10:00', '303', '[{"k":"kistyanti","n":"NI MADE RAI KISTYANTI, M.PSI., PSIKOLOG"}]', 'offline'),
    (5, '15152007', 'A', '2025-10-28', '11:00', '13:00', '301', '[{"n":"JUNI ARATIKA"}]', 'offline'),
    (5, '15152007', 'B', '2025-10-28', '11:00', '13:00', '302', '[{"k":"septilla","n":"A. EKA SEPTILLA, M.PSI., PSIKOLOG"}]', 'offline'),
    (5, '15152007', 'C', '2025-10-28', '11:00', '13:00', '303', '[{"k":"rahmani","n":"SOFI FITRIA RAHMANI, M.PD"}]', 'offline'),
    (5, '15152003', 'A', '2025-10-29', '08:00', '10:00', '301', '[{"k":"vinaya","n":"DR. VINAYA, M.SI"}]', 'offline'),
    (5, '15152003', 'B', '2025-10-29', '08:00', '10:00', '302', '[{"k":"ramadhana","n":"M. RAMADHANA, M.SI"}]', 'offline'),
    (5, '15152003', 'C', '2025-10-29', '08:00', '10:00', '303', '[{"k":"seta","n":"DR. SETA A. WICAKSANA, M.PSI., PSIKOLOG"}]', 'offline'),
    (5, '15152008', 'A', '2025-10-29', '11:00', '13:00', NULL, '[{"n":"AKADEMIK"}]', 'project'),
    (5, '15152008', 'B', '2025-10-29', '11:00', '13:00', NULL, '[{"n":"AKADEMIK"}]', 'project'),
    (5, '15152008', 'C', '2025-10-29', '11:00', '13:00', NULL, '[{"n":"AKADEMIK"}]', 'project'),
    (5, '15143009', 'A', '2025-10-30', '08:00', '10:00', '301', '[{"k":"anindya","n":"ANINDYA DEWI PARAMITA, M.PSI., PSIKOLOG"}]', 'offline'),
    (5, '15143009', 'B', '2025-10-30', '08:00', '10:00', '302', '[{"k":"anindya","n":"ANINDYA DEWI PARAMITA, M.PSI., PSIKOLOG"}]', 'offline'),
    (5, '15143009', 'C', '2025-10-30', '08:00', '10:00', '303', '[{"k":"farida_aini","n":"FARIDA AINI, M.PSI., PSIKOLOG"}]', 'offline'),
    (5, '15162002', 'A', '2025-10-30', '11:00', '13:00', NULL, '[{"n":"AKADEMIK"}]', 'online'),
    (5, '15162002', 'B', '2025-10-30', '11:00', '13:00', NULL, '[{"n":"AKADEMIK"}]', 'online'),
    (5, '15162002', 'C', '2025-10-30', '11:00', '13:00', NULL, '[{"n":"AKADEMIK"}]', 'online'),
    (5, '15153001', 'A', '2025-10-31', '08:00', '10:00', NULL, '[{"n":"AKADEMIK"}]', 'project'),
    (5, '15153001', 'B', '2025-10-31', '08:00', '10:00', NULL, '[{"n":"AKADEMIK"}]', 'project'),
    (5, '15153001', 'C', '2025-10-31', '08:00', '10:00', NULL, '[{"n":"AKADEMIK"}]', 'project'),
    (5, '15152011', 'A', '2025-10-31', '13:00', '15:00', NULL, '[{"n":"AKADEMIK"}]', 'project'),
    (5, '15152011', 'B', '2025-10-31', '13:00', '15:00', NULL, '[{"n":"AKADEMIK"}]', 'project')
) AS v(smt, kode, kelas, tanggal, mulai, selesai, room, pengawas, ket)
WHERE EXISTS (SELECT 1 FROM courses c WHERE c.kode_mk = v.kode)
ON CONFLICT ON CONSTRAINT uq_exams DO NOTHING;

DROP TABLE _dosen;
DROP TABLE _dosen_src;

-- ==============================================================================
-- Migration: 20261002000004_seed_sidang_2025_2026_gasal.sql
-- Description: Seed the prasidang and sidang schedule of 2025/2026 Gasal.
--
-- Sources: docs/Jadwal Prasidang Gasal 2025-2026.xlsx (15 mahasiswa, 24-25 Nov 2025, kelompok 1-3)
-- and docs/jadwal sidang master.xlsx (12 mahasiswa, 3 Feb 2026, ruang 301-303). Requires
-- 20261002000002_defenses.sql. Idempotent: a mahasiswa already scheduled for that jenis in that year
-- (same NPM) is left alone.
--
-- Generated by a one-off Node script (not checked in) that parsed both sheets and matched dosen by name.
-- Decisions, on purpose:
--
-- 1. The year 2025/2026 Gasal (20251) is created, NOT active (the sidang of 3 Feb 2026 is titled Gasal in
--    its source). Empty slots in the sheets (no mahasiswa) are not seeded.
-- 2. Dosen are matched to the dosen master by name when this runs. A role whose dosen is not in the master
--    (or matches more than one) is left empty instead of guessed; fill it in on /sidang after adding the
--    dosen. Against the dosen seeded by 20260922000002, every dosen in these sheets resolves.
-- 3. The external examiner (sidang Penguji I) is free text, as typed in the sheet: Prof. Farida Kurniawati,
--    Dr. Ade Iva Murty, Dr. Eva Septiana, Dr. Lucia RM Royanto and Prof. Dr. Awaluddin Tjalla. It stays
--    text even for a name that is also in the dosen master (Awaluddin Tjalla is), as the field always is.
-- 4. Names and titles are kept as typed in the sheets (the printed sheets use title case).
-- 5. The sheets have no clashes between dosen, external examiners or rooms (checked with the app's rules).
-- ==============================================================================

INSERT INTO academic_years (id, label, is_active)
VALUES ('20251', '2025/2026 Gasal', false)
ON CONFLICT (id) DO NOTHING;

-- Match each source dosen to the dosen master by name tokens. A key resolves only when exactly one
-- lecturer matches; otherwise it stays NULL (a defense role is left empty, a pengawas falls back to
-- the name as free text). Temp tables, dropped at the end.
CREATE TEMP TABLE _dosen_src (src text PRIMARY KEY, t1 text NOT NULL, t2 text NOT NULL);
INSERT INTO _dosen_src (src, t1, t2) VALUES
    ('aisyah', 'aisyah', 'aisyah'),
    ('akhyar', 'akhyar', 'akhyar'),
    ('anindya', 'anindya', 'anindya'),
    ('bimo', 'bimo', 'wikant'),
    ('dharma', 'dharma', 'dharma'),
    ('evanytha', 'evanytha', 'evanytha'),
    ('farida_aini', 'farida', 'aini'),
    ('grashinta', 'grashinta', 'grashinta'),
    ('kistyanti', 'kistyanti', 'kistyanti'),
    ('maharani', 'maharani', 'maharani'),
    ('nindyati', 'nindyati', 'nindyati'),
    ('ramadhana', 'ramadhana', 'ramadhana'),
    ('septilla', 'septilla', 'septilla'),
    ('seta', 'seta', 'wicaksana'),
    ('silverius', 'silverius', 'soeharso'),
    ('suwandi', 'suwandi', 'suwandi'),
    ('vinaya', 'vinaya', 'vinaya'),
    ('wiroko', 'wiroko', 'wiroko');

CREATE TEMP TABLE _dosen AS
SELECT s.src, CASE WHEN count(l.kode_dosen) = 1 THEN min(l.kode_dosen) END AS kode
FROM _dosen_src s
LEFT JOIN lecturers l ON lower(l.nama) LIKE '%' || s.t1 || '%' AND lower(l.nama) LIKE '%' || s.t2 || '%'
GROUP BY s.src;

INSERT INTO defenses (academic_year_id, jenis, tanggal, jam_mulai, jam_selesai, room_id, kelompok, npm, nama_mahasiswa, judul_skripsi, pembimbing_kode, penguji_kode, penguji_eksternal)
SELECT
    '20251', v.jenis, v.tanggal::date, v.mulai::time, v.selesai::time,
    (SELECT r.id FROM rooms r WHERE r.nama = v.ruang),
    v.kelompok::smallint, v.npm, v.nama, v.judul,
    (SELECT d.kode FROM _dosen d WHERE d.src = v.pb),
    (SELECT d.kode FROM _dosen d WHERE d.src = v.pj),
    v.eksternal
FROM (VALUES
    ('prasidang', '2025-11-24', 1, NULL, '10:30', '11:30', '6021210068', 'Fadhlan Wibisono H', 'Hubungan Antara Future Anxiety Dengan Quality Of Life Pada Generasi Z Di Indonesia', 'dharma', 'maharani', ''),
    ('prasidang', '2025-11-24', 1, NULL, '13:00', '14:00', '6022210039', 'Jihan Shabrina Feby Amelia', 'Peran Help Seeking Behavior Melalui (Website Beranibersuara.Id) Terhadap Online Sexual Harassment', 'aisyah', 'anindya', ''),
    ('prasidang', '2025-11-24', 1, NULL, '14:30', '15:30', '6022210059', 'Najwa Prajna Phalita Kurniawan', 'Peran Social Comparison Dan Social Media Rumination Dalam Memprediksi Social Media Addiction Pada Remaja', 'anindya', 'evanytha', ''),
    ('prasidang', '2025-11-24', 2, NULL, '09:00', '10:00', '6021210064', 'Saniy Saffanah T', 'Pengaruh Social Support Dan Social Comparison Terhadap Career Anxiety Pada Fresh Graduate Emerging Adult', 'evanytha', 'silverius', ''),
    ('prasidang', '2025-11-24', 2, NULL, '10:30', '11:30', '6021210087', 'Wardah Yasmine Shakila Mahdar', 'Hubungan Self Regulation Dan Academic Buoyancy Pada Mahasiswa Gen Z Dengan Problematic Social Media Use', 'suwandi', 'silverius', ''),
    ('prasidang', '2025-11-24', 2, NULL, '13:00', '14:00', '6020210070', 'Muchammad Haikal Bichaq', 'Hubungan Antara Self Discrepancy Dengan Perilaku Impulsive Buying Pada Cosplayer Dewasa Muda', 'ramadhana', 'evanytha', ''),
    ('prasidang', '2025-11-25', 1, NULL, '09:00', '10:00', '6020210088', 'Injie Zahwa Aulia', 'Peran Pemberdayaan Psikologis Terhadap OCB (Organizational Citizenship Behavior) Pada Karyawan Kopi Kina', 'wiroko', 'seta', ''),
    ('prasidang', '2025-11-25', 1, NULL, '10:30', '11:30', '6019210059', 'Ichlasun Naas Ibrahiem', 'Peran Kepribadian Proaktif Terhadap Self-Perceived Employability Pada Pekerja Industri Manufaktur', 'wiroko', 'nindyati', ''),
    ('prasidang', '2025-11-25', 1, NULL, '13:00', '14:00', '6022210038', 'Ramdan Malik Prawira', 'Gambaran Burnout Pada Pegawai Dinas Kependudukan Dan Pencatatan Sipil (Dukcapil) Kota Depok', 'bimo', 'nindyati', ''),
    ('prasidang', '2025-11-25', 2, NULL, '08:00', '09:00', '6021210017', 'Alfia Rizkyani', 'Hubungan Problematic Online Game Use (Pogu) Dengan Kualitas Tidur Pada Gen Z Pemain Game Roblox', 'aisyah', 'grashinta', ''),
    ('prasidang', '2025-11-25', 2, NULL, '10:30', '11:30', '6022210071', 'Larashaty Putri Prameswari', 'Pengaruh Adverse Childhood Experiences Dan Social Media Rumination Terhadap Social Media Addiction Pada Remaja', 'anindya', 'aisyah', ''),
    ('prasidang', '2025-11-25', 2, NULL, '13:00', '14:00', '6019210047', 'Ulva Andini', 'Hubungan Antara Romantic Love Myth Dengan Cyber Dating Violence Pada Emerging Adults Korban Kekerasan Dalam Pacaran', 'akhyar', 'maharani', ''),
    ('prasidang', '2025-11-25', 2, NULL, '14:30', '15:30', '6020210081', 'Fildza Wafiq Ghasani', 'Hubungan Self Esteem Dengan Komitmen Pernikahan Pada Dewasa Yang Berselingkuh', 'septilla', 'aisyah', ''),
    ('prasidang', '2025-11-25', 3, NULL, '13:00', '14:00', '6021210051', 'Aurelia Bilbina', 'Pengaruh Dukungan Sosial dan Kebersyukuran terhadap Resiliensi Pada Penderita Lupus Fase Emerging Adulthood', 'evanytha', 'seta', ''),
    ('prasidang', '2025-11-25', 3, NULL, '14:30', '15:30', '6022210067', 'Aisyah Kenia Fadyah', 'Peran Self-Esteem Dan Self-Disclosure Terhadap Tingkat Intimacy Dalam Hubungan Romantis Melalui Dating Apps Pada Emerging Adulthood', 'kistyanti', 'anindya', ''),
    ('sidang', '2026-02-03', NULL, '301', '08:00', '10:00', '6019210059', 'Ichlasun Naas Ibrahiem', 'Peran Kepribadian Proaktif Terhadap Self-Perceived Employability Pada Pekerja Industri Manufaktur', 'wiroko', 'anindya', 'Dr. Eva Septiana, M.Si., Psikolog'),
    ('sidang', '2026-02-03', NULL, '301', '11:00', '13:00', '6020210121', 'Tiara Pragati Wira Anggini', 'Pengaruh Environmental Knowledge dengan Green Cosmetics Purchase Intention pada Perempuan Emerging Adulthood di Jabodetabek', 'dharma', 'nindyati', 'Dr. Ade Iva Murty, M.Si'),
    ('sidang', '2026-02-03', NULL, '301', '13:00', '15:00', '6019210044', 'Indah Safitri Ningrum', 'Peran Self Esteem Terhadap Romantic Jealousy Pada Individu Early Adulthood Yang Menikah', 'maharani', 'aisyah', 'Dr. Ade Iva Murty, M.Si'),
    ('sidang', '2026-02-03', NULL, '301', '15:00', '17:00', '6019210097', 'Feni Setianingsih', 'Hubungan Attachment Style dengan Fear of Commitment pada Generasi Z yang Memilih Hubungan Tanpa Status (Situationships)', 'maharani', 'evanytha', 'Prof. Farida Kurniawati, M.Sp.Ed., Ph.D'),
    ('sidang', '2026-02-03', NULL, '302', '08:00', '10:00', '6019210047', 'Ulva Andini', 'Hubungan Antara Romantic Love Myth Dengan Dating Violence Pada Emerging Adults Korban Kekerasan Dalam Pacaran', 'vinaya', 'maharani', 'Prof. Dr. Awaluddin Tjalla, M.Pd'),
    ('sidang', '2026-02-03', NULL, '302', '10:00', '12:00', '6020210093', 'Salma Novita Rachma Danty', 'Gambaran Stage Of Grief Pada Istri Pasca Kematian Pasangan Hidup Akibat Kanker Paru-Paru', 'septilla', 'seta', 'Prof. Dr. Awaluddin Tjalla, M.Pd'),
    ('sidang', '2026-02-03', NULL, '302', '13:00', '15:00', '6021210058', 'Savitri Nurhalizah', 'Hubungan Loneliness dan Perilaku Agresi Pada Emerging Adulthood Yang Menjalani Long Distance Relationship', 'kistyanti', 'wiroko', 'Prof. Farida Kurniawati, M.Sp.Ed., Ph.D'),
    ('sidang', '2026-02-03', NULL, '302', '15:00', '17:00', '6021210017', 'Alfia Rizkyani', 'Peran Problematic Online Game Use (Pogu) Terhadap Kualitas Tidur Pada Gen Z Pemain Game Roblox', 'aisyah', 'vinaya', 'Dr. Ade Iva Murty, M.Si'),
    ('sidang', '2026-02-03', NULL, '303', '08:00', '10:00', '6021210010', 'Nicolas Immanuel Wong', 'Hubungan Fear of Missing Out dengan Intensitas Keinginan Melakukan Aktivitas Olahraga pada Remaja Akhir di Kabupaten Bogor', 'seta', 'evanytha', 'Prof. Farida Kurniawati, M.Sp.Ed., Ph.D'),
    ('sidang', '2026-02-03', NULL, '303', '10:00', '12:00', '6021210005', 'Ezra Raistan Koral', 'Hubungan Dukungan Sosial dan Burnout Pada Shadow Teacher Pendamping Anak Autis Di Sekolah Inklusi', 'farida_aini', 'grashinta', 'Prof. Farida Kurniawati, M.Sp.Ed., Ph.D'),
    ('sidang', '2026-02-03', NULL, '303', '13:00', '15:00', '6021210080', 'Moch. Rafi Rachman', 'Hubungan Intolerance Of Uncertainty Terhadap Academic Stress Pada Mahasiswa Semester Akhir', 'farida_aini', 'grashinta', 'Dr. Lucia RM Royanto, M.Si, Sp.Ed., Psikolog'),
    ('sidang', '2026-02-03', NULL, '303', '15:00', '17:00', '6021210087', 'Wardah Yasmine Shakila Mahdar', 'Hubungan Self Regulation dan Academic Buoyancy Pada Mahasiswa Gen Z Dengan Problematic Social Media Use', 'grashinta', 'silverius', 'Prof. Dr. Awaluddin Tjalla, M.Pd')
) AS v(jenis, tanggal, kelompok, ruang, mulai, selesai, npm, nama, judul, pb, pj, eksternal)
ON CONFLICT (academic_year_id, jenis, npm) DO NOTHING;

DROP TABLE _dosen;
DROP TABLE _dosen_src;

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

-- ==============================================================================
-- Migration: 20261008000001_header_line_breaks.sql
-- Description: Restores the line breaks in the UTS/UAS, prasidang and sidang
-- print-title templates where a value was stored on a single line.
-- ==============================================================================
-- The UTS/UAS, prasidang and sidang print titles are one line per row ("\n"-separated).
-- Some databases ended up with these values on a single line, which prints every title line
-- run together in one cell. Restore the default multi-line templates wherever a value has no
-- line break at all; templates that already have line breaks (including edited ones) are kept.

update settings set value = E'JADWAL EVALUASI {ujian} SEMESTER\nSEMESTER {semester}{program} ANGKATAN {angkatan_ta}\nSEMESTER {term} TAHUN AKADEMIK {tahun}'
where key = 'ujian_header_baris' and value !~ '[\r\n]';

update settings set value = case prodi
        when 's2' then E'JADWAL SEMINAR PROPOSAL TESIS SEMESTER {term} TAHUN AKADEMIK {tahun}\n{tanggal}\nKELOMPOK {kelompok}'
        else E'JADWAL PRASIDANG SKRIPSI SEMESTER {term} TAHUN AKADEMIK {tahun}\n{tanggal}\nKELOMPOK {kelompok}'
    end
where key = 'prasidang_header_baris' and value !~ '[\r\n]';

update settings set value = case prodi
        when 's2' then E'JADWAL SIDANG TESIS SEMESTER {term} TAHUN AKADEMIK {tahun}\n{tanggal}\nRUANG {ruang}\nFAKULTAS PSIKOLOGI UNIVERSITAS PANCASILA'
        else E'JADWAL SIDANG SKRIPSI SEMESTER {term} TAHUN AKADEMIK {tahun}\n{tanggal}\nRUANG {ruang}\nFAKULTAS PSIKOLOGI UNIVERSITAS PANCASILA'
    end
where key = 'sidang_header_baris' and value !~ '[\r\n]';

-- ==============================================================================
-- Migration: 20261008000002_s2_reguler_malam.sql
-- Description: S2 Reguler starts at 18:00; S2 drops the Reguler Khusus settings.
-- ==============================================================================
-- S2 Psikologi Profesi has only Reguler, and its Reguler classes run in the evening.
-- The S2 settings were copied from S1, so S2 started at the S1 morning time (07:30) and
-- carried Reguler Khusus settings nothing reads for S2.

update settings
set value = '18:00', help = 'Waktu mulai perkuliahan reguler S2 (malam)'
where key = 'jam_mulai_reguler' and prodi = 's2' and value = '07:30';

delete from settings where prodi = 's2' and key in ('jam_mulai_regsus', 'sesi_ujian_regsus');
