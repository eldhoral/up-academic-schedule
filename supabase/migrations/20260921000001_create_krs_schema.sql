-- ==============================================================================
-- Migration: 20260921000001_create_krs_schema.sql
-- Description: Core schema for KRS Scheduling System (S1 Psikologi Universitas Pancasila)
-- Tables: academic_years, courses, lecturers, rooms, sessions, schedules, schedule_lecturers, settings
-- ==============================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. Academic Years (Tahun Akademik)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS academic_years (
    id VARCHAR(20) PRIMARY KEY, -- e.g. '20261' = 2026/2027 Gasal
    label TEXT NOT NULL,       -- e.g. '2026/2027 Gasal'
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER update_academic_years_updated_at
    BEFORE UPDATE ON academic_years
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 2. Courses (Mata Kuliah) - Master catalog following 2026 curriculum
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    kode_mk VARCHAR(20) PRIMARY KEY,
    nama_mk TEXT NOT NULL,
    sks INTEGER NOT NULL CHECK (sks > 0),
    smt INTEGER NOT NULL CHECK (smt BETWEEN 1 AND 8),
    jenis_mk VARCHAR(1) NOT NULL CHECK (jenis_mk IN ('A', 'B')), -- 'A' = Wajib, 'B' = Pilihan
    kurikulum VARCHAR(20) NOT NULL DEFAULT '2026',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_courses_smt ON courses (smt);
CREATE INDEX IF NOT EXISTS idx_courses_kurikulum ON courses (kurikulum);

CREATE TRIGGER update_courses_updated_at
    BEFORE UPDATE ON courses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 3. Lecturers (Dosen)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lecturers (
    kode_dosen VARCHAR(30) PRIMARY KEY,
    nidn VARCHAR(20), -- TEXT to preserve leading zeros
    nama TEXT NOT NULL,
    gelar_depan TEXT NOT NULL DEFAULT '',
    gelar_belakang TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_lecturers_nama ON lecturers (nama);

CREATE TRIGGER update_lecturers_updated_at
    BEFORE UPDATE ON lecturers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 4. Rooms (Ruangan)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama VARCHAR(50) NOT NULL UNIQUE,
    kapasitas INTEGER NOT NULL DEFAULT 0,
    keterangan TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TRIGGER update_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 5. Sessions (Sesi Perkuliahan)
-- ------------------------------------------------------------------------------
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

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 6. Schedules (Jadwal Perkuliahan)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academic_year_id VARCHAR(20) NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    jenis_kelas VARCHAR(20) NOT NULL CHECK (jenis_kelas IN ('reguler', 'regsus')),
    semester_ke INTEGER NOT NULL CHECK (semester_ke BETWEEN 1 AND 8),
    kode_mk VARCHAR(20) NOT NULL REFERENCES courses(kode_mk) ON DELETE RESTRICT,
    kelas VARCHAR(5) NOT NULL, -- e.g. 'A', 'B', 'C'
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

CREATE TRIGGER update_schedules_updated_at
    BEFORE UPDATE ON schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 7. Schedule Lecturers (Dosen Pengampu Jadwal) - Team teaching support
-- Zero rows means MKWU (Mata Kuliah Wajib Universitas)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 8. Settings (Pengaturan Sistem) - Key-value store for application rules
-- ------------------------------------------------------------------------------
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

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
