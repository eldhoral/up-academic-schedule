# Supabase Database Migration & Setup (Phase 1)

This directory contains the database schema, security policies, and initial seed data for the **KRS Scheduling System (Universitas Pancasila - S1 Psikologi)**.

---

## Directory Structure

- **`all_in_one_setup.sql`**: Consolidated script containing all tables, indexes, triggers, RLS policies, and seed data. Perfect for running in the Supabase Dashboard SQL Editor in one go.
- **`migrations/20260921000001_create_krs_schema.sql`**: Table definitions, check constraints, foreign keys, and indexes.
- **`migrations/20260921000002_enable_rls_policies.sql`**: Row Level Security (RLS) configuration ensuring only authenticated users can read/write.
- **`migrations/20260921000003_seed_initial_data.sql`**: Initial seed data for the active academic year (`20261` = "2026/2027 Gasal") and all 22 system settings.

---

## How to Apply

### Option A: Supabase Web Dashboard (Fastest)

1. Open your project on [database.new](https://database.new) or your Supabase Dashboard.
2. Navigate to **SQL Editor** in the left sidebar.
3. Click **New query**.
4. Copy the entire contents of [`all_in_one_setup.sql`](file:///Users/ddt/Documents/krs/supabase/all_in_one_setup.sql) and paste it into the query editor.
5. Click **Run** (or `Cmd + Enter`).

---

### Option B: Using Supabase CLI

If you have `supabase` CLI installed and linked to your project:

```bash
# Apply pending migrations to linked remote Supabase project
npx supabase db push

# Or if running locally:
npx supabase start
npx supabase migration up
```

---

## Tables Overview

| Table | Description | Primary Key / Uniqueness |
|---|---|---|
| `academic_years` | Academic year periods (e.g. `20261` for 2026/2027 Gasal) | `id` |
| `courses` | Master course catalog (2026 curriculum) with SKS and semester | `kode_mk` |
| `lecturers` | Master lecturer database with NIDN (as text) and academic titles | `kode_dosen` |
| `rooms` | Available classrooms (301, 302, 303, Lab. Kom, etc.) | `id` (UUID), unique `nama` |
| `sessions` | Configurable class timetable slots per day | `id` (UUID) |
| `schedules` | Main schedule entries with day, time, room, zoom, and class | `id` (UUID), unique `(academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas)` |
| `schedule_lecturers` | Lecturer assignments per schedule (supports team teaching) | `id` (UUID), unique `(schedule_id, kode_dosen)` |
| `settings` | Dynamic key-value configuration for scheduling rules, clashes, & print layouts | `key` |

---

## Security Policies (RLS)

- All 8 tables have **Row Level Security enabled**.
- Permissive access is granted strictly to the **`authenticated`** role (`TO authenticated USING (true) WITH CHECK (true)`).
- Anonymous access (`anon`) is blocked by default.
