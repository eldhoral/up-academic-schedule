# KRS Scheduling — Technical Specification Document

|  |  |
|---|---|
| **System** | KRS Scheduling (Penjadwalan Akademik) — Fakultas Psikologi, Universitas Pancasila |
| **Document** | Technical Specification Document (TSD) |
| **Version** | 1.0 |
| **Date** | 17 October 2026 |
| **Status** | Describes the current working tree |
| **Audience** | Developers, maintainers, and technical reviewers of the system |
| **Related documents** | [`README.md`](README.md) (getting started) · [`PLAN.md`](PLAN.md) (original design rationale) · [`.interface-design/system.md`](.interface-design/system.md) (visual system "Bilah") · [`AGENTS.md`](AGENTS.md) (Next.js agent rules) · [`supabase/README.md`](supabase/README.md) |

---

## 1. Purpose and Scope

### 1.1 What the system is

KRS Scheduling is an internal, staff-only web application used by the Faculty of Psychology (Fakultas Psikologi) of Universitas Pancasila to build and maintain the academic schedules of its two study programs:

- **S1 Psikologi** — 8 semesters, Reguler and Reguler Khusus classes.
- **S2 Psikologi Profesi** — 4 semesters, Reguler only.

For each program and academic year the system maintains three schedules:

1. **Jadwal Kuliah** — weekly classes per semester and kelas, with lecturers (including team teaching), room or Zoom, and odd/even-week parity.
2. **Jadwal UTS/UAS** — exam date, time, room, pengawas (invigilators) and exam mode (Offline, Online, Take Home, Project, Ujian Lisan).
3. **Jadwal Prasidang & Sidang** — thesis defenses. S1: Prasidang & Sidang Skripsi; S2: Seminar Proposal & Sidang Tesis.

Around those three schedules the system provides: live clash detection with configurable policies, overrides with recorded reasons, Excel import/export of master data, printable official documents (Excel and PDF, plus a Word Surat Penugasan), a combined calendar, a per-lecturer secret-link schedule with an `.ics` calendar feed, faculty-wide holidays, and a full audit trail.

### 1.2 In scope

- CRUD and import/export of master data: Mata Kuliah, Dosen, Ruangan, Mahasiswa, Sesi, Tahun Akademik.
- Scheduling and clash-checking of kuliah, exams and defenses.
- Printing/exporting the official schedule documents and per-lecturer recaps.
- Public read-only views for lecturers (token URL + calendar feed).
- Role-based access: Super Admin, Penjadwal (scheduler), Pemantau (viewer).
- Audit trail of every data change, with a change-history viewer.

### 1.3 Out of scope

- Student-facing features (students do not log in; KRS submission itself is not part of this tool).
- Automatic schedule optimization/solving — all placements are made by staff; the system only detects and reports conflicts.
- Multi-faculty tenancy — the deployment serves one faculty with two study programs.
- Integration with external academic systems (SIAKAD, LMS); the only public surface is the lecturer link.

### 1.4 Reading guide

Sections 3–5 cover context, architecture and the data model (reference material). Section 6 specifies the domain rules — the behavior the check scripts pin down. Sections 7–9 cover settings, security and operations. Section 10 lists constraints and known future work.

---

## 2. Terminology

| Term | Meaning in this system |
|---|---|
| **Tahun Akademik (TA)** | Academic year + term, e.g. `20261` = 2026/2027 Gasal. Rows live in `academic_years`. |
| **Gasal / Genap** | Odd / even term. Encoded in the TA id suffix (`…1` = Gasal, `…2` = Genap). |
| **Prodi** | Study program: `s1` or `s2`. A URL and data dimension, not a table. |
| **Jenis Kelas** | Class track: `reguler` (morning) or `regsus` (Reguler Khusus, evening). S2 has only `reguler`. |
| **Kelas** | Class letter within a semester (A, B, C …), or the literal `GABUNGAN` on exams. |
| **MK / Mata Kuliah** | Course. `jenis_mk` A = wajib (compulsory), B = pilihan (elective). |
| **Sesi** | A predefined daily time slot (`sesi_ke`, start/end, SKS capacity), generated from settings and maintainable. |
| **Minggu** | Week parity of a weekly meeting: `setiap` (every week), `ganjil` (odd weeks), `genap` (even weeks). |
| **Bentrok** | Clash. Types: `dosen` (lecturer), `kelas` (class), `ruangan` (room). |
| **Kebijakan bentrok** | Per-type policy: `blok` (refuse save), `peringatan` (warn), `abaikan` (ignore). |
| **Override** | A blocked clash saved deliberately, with a written reason (`is_override`, `override_reason`). |
| **UTS / UAS** | Mid-term / final exams. |
| **Prasidang** | S1 thesis proposal hearing — held on Zoom in numbered breakout rooms (`kelompok`); on S2 it is the Seminar Proposal. |
| **Sidang** | Thesis defense — held in a physical room, with Pembimbing, Ketua Sidang, Anggota Penguji I (penguji eksternal) and Anggota Penguji II. |
| **Pengawas** | Exam invigilator (a dosen), stored as a JSON array on the exam row. |
| **MKWU** | University-wide compulsory course taught with no assigned pengampu — a schedule row with zero `schedule_lecturers`. |
| **Beban** | Teaching load: total SKS per dosen in a term, checked against `maks_sks_dosen`. |
| **Hari Libur** | Faculty-wide holiday. Kuliah pauses on it; exams/defenses only get a warning. |

---

## 3. System Context

### 3.1 Actors

| Actor | Role in the system | Access |
|---|---|---|
| **Super Admin** (`SUPERADMIN`) | Faculty IT/administration | Everything: master data, settings, users, all prodi schedules |
| **Penjadwal** (`SCHEDULER`) | Scheduling staff | Writes kuliah/ujian/sidang rows within their `prodi_access`; reads everything |
| **Pemantau** (`VIEWER`) | Read-only staff | Reads everything; no writes |
| **Dosen (lecturer)** | No account. Holds a secret link | Reads only their own schedule page and `.ics` feed |
| **Supabase** | Platform | Postgres, Auth, Storage, Row Level Security |
| **Vercel** | Hosting | Runs the Next.js app (production: `up-academic-schedule.vercel.app`) |
| **Aspose Cells Cloud** | Optional external service | Converts generated xlsx to PDF (free tier: 150 conversions/month) |

### 3.2 Deployment view

```
                     ┌──────────────────────────────────────────────┐
  Staff (session) ──▶│ Vercel — Next.js 16 app                      │
                     │   proxy.ts  → session gate (fail closed)     │
                     │   server components / server actions         │
                     │   route handlers (xlsx, docx, pdf, ics, json)│
                     └───────┬──────────────────────┬───────────────┘
                             │ anon key + cookies   │ service-role key (server only)
                             ▼                      ▼
                     ┌──────────────────────────────────────────────┐
  Dosen (token URL) ▶│ Supabase — Postgres + Auth + Storage          │
                     │   RLS on every table · audit triggers         │
                     │   pg_cron: nightly audit_log purge            │
                     └──────────────────────────────────────────────┘
```

The public lecturer pages bypass the session gate but read through the **service-role** client, scoped to the token's lecturer only.

---

## 4. Architecture

### 4.1 Technology stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16.3.8 (App Router) | `src/proxy.ts` is the session gate (Next 16's renamed middleware). This version differs from older Next.js — read the bundled docs in `node_modules/next/dist/docs/` before writing code (see `AGENTS.md`). |
| UI | React 19.2.8, Tailwind CSS 4 | Server components by default; client islands only where interaction demands it. |
| Language | TypeScript 5 | `npx tsc --noEmit` and `next build` both type-check; `next build` also checks `scripts/*.ts`. |
| Data | Supabase Postgres + `@supabase/supabase-js` 2.x, `@supabase/ssr` | RLS on every table; three client kinds (see 4.4). |
| Files | `exceljs` (xlsx read/write), `docx` (Word), JSZip (check scripts) | Excel import/export, print downloads, Surat Penugasan. |
| PDF | Aspose Cells Cloud (optional) | Only when `ASPOSE_CLIENT_ID` / `ASPOSE_CLIENT_SECRET` are set; xlsx download always works. |
| Testing | Node `assert` scripts run with `tsx` | Pure-logic suites; see §9.5. |
| Lint | ESLint 9 + `eslint-config-next` | `npm run lint`. |
| Runtime | Node 22+ | Required by `README.md`. |

### 4.2 Runtime topology

- **Pages**: React Server Components read Supabase directly (anon key + user session → RLS applies).
- **Writes**: Server Actions co-located with pages (`actions.ts`) validate input, run clash checks, and return `{ error }` objects for inline display — they do not throw to the error boundary for expected failures.
- **Route handlers** serve binary/JSON responses: xlsx exports, xlsx templates, docx, PDF, ICS, and two small JSON APIs.
- **No global store, no client-side data fetching** for page data: filters live in URL query parameters (`ay`, `prodi`, `smt`, `jenis`, `week`, …), so every view is linkable and shareable.

### 4.3 Request lifecycle

1. **`src/proxy.ts`** (matcher = all paths except static assets) calls `updateSession()` from `src/lib/supabase/proxy.ts`.
   - Skips: `/_next/*`, `/auth/*`, `/jadwal-dosen/*` (public), `/favicon.ico`, static file extensions.
   - If env vars are missing/placeholder: pass through (allows local start without Supabase).
   - Unauthenticated users on any other path → redirect to `/masuk?redirectTo=<path>`.
   - Authenticated users on `/masuk` → redirect to `redirectTo` or `/`.
   - **Fails closed**: if the auth check throws, the request is redirected to `/masuk`.
   - Uses `auth.getClaims()` — local JWT verification with asymmetric signing keys.
2. **`src/app/[prodi]/layout.tsx`** — `parseProdi()` (unknown → 404), session check, and `canAccessProdi(user.prodiAccess, prodi)` (no access → `/`).
3. **Page** — server component loads data with the RLS-scoped client and renders.
4. **Config redirects** (`next.config.ts`) run *before* proxy and the filesystem: they preserve pre-S2 bookmarks (`/kuliah → /s1/kuliah`, `/ujian → /s1/ujian`, etc.). `/kalender` is deliberately **not** redirected — it is the Kalender Gabungan (§6.9).

New routes require `npx next typegen` so the typed `PageProps<'/route'>` / `RouteContext<'/route'>` helpers resolve.

### 4.4 Supabase clients

| File | Kind | Used for |
|---|---|---|
| `src/lib/supabase/server.ts` | SSR client with cookies (anon key) | All normal page/action reads and writes — **RLS applies as the logged-in user** |
| `src/lib/supabase/client.ts` | Browser client | Rare client-side auth flows (e.g. change password) |
| `src/lib/supabase/admin.ts` | Service-role client | Privileged server-only operations: the Pengguna page (create/delete accounts, change roles), login/logout audit entries, and the public `/jadwal-dosen` reads. Bypasses RLS — never import from client code. |
| `src/lib/supabase/proxy.ts` | Session refresh inside `proxy.ts` | Cookie refresh + route gating |

### 4.5 Route map

**Shared / top level**

| Route | Purpose | Who |
|---|---|---|
| `/` | Hub: per-prodi status tallies, nav, "Perubahan Terbaru" audit strip | Signed-in |
| `/kalender` | Kalender Gabungan — one week grid, both prodi, all schedule types | Signed-in |
| `/dosen` | Lecturer master data + import/export | Super Admin writes; all read |
| `/ruangan` | Room master data | Super Admin writes |
| `/tahun-akademik` | Academic years (term dates) + **Hari Libur** management | Super Admin |
| `/pengguna` | User accounts, roles, prodi access | Super Admin (service-role actions) |
| `/log-aktivitas` | Audit log browser (filters, paging) | Signed-in |
| `/log-aktivitas/riwayat?tabel=…&id=…` | Per-record change history (timeline + diff) | Signed-in |
| `/masuk` | Login | Public |
| `/atur-kata-sandi` | Change own password | Signed-in |
| `/auth/callback` | Supabase auth code exchange | Public |

**Per program (`/s1/...`, `/s2/...`)** — guarded by prodi layout

| Route | Purpose |
|---|---|
| `/[prodi]/kuliah` | Weekly class schedule board (+ clash findings, copies from previous year) |
| `/[prodi]/kuliah/kalender` | Per-program weekly calendar (filterable) |
| `/[prodi]/kuliah/cetak` | Printable schedule sheet — preview; `/xlsx`, `/pdf` downloads |
| `/[prodi]/kuliah/rekap` | Per-dosen recap / Surat Penugasan — `/docx` download |
| `/[prodi]/ujian` | UTS/UAS board (dates, rooms, pengawas) |
| `/[prodi]/ujian/kalender` | Exam calendar |
| `/[prodi]/ujian/cetak` | Exam schedule — preview; `/xlsx`, `/pdf` |
| `/[prodi]/ujian/rekap` | Pengawas recap — `/xlsx` |
| `/[prodi]/sidang` | Prasidang & Sidang board (S2: Seminar Proposal & Tesis) |
| `/[prodi]/sidang/kalender` | Defense calendar |
| `/[prodi]/sidang/cetak` | Defense schedule — preview; `/xlsx`, `/pdf` |
| `/[prodi]/mata-kuliah` | Course master data + import/export |
| `/[prodi]/mahasiswa` | Student master (NPM, nama, judul) + import/export |
| `/[prodi]/sesi` | Session slot management (generated from settings, editable) |
| `/[prodi]/pengaturan` | Settings for this prodi (+ shared `all` tier) |

**Public**

| Route | Purpose |
|---|---|
| `/jadwal-dosen/[token]` | Lecturer's own schedule (no login) |
| `/jadwal-dosen/[token]/kalender.ics` | Calendar subscription feed |

### 4.6 API routes and JSON endpoints

| Route | Response |
|---|---|
| `GET /api/clashes?ay=&prodi=` | Kuliah clash findings as JSON (used by live boards) |
| `GET /api/schedules?ay=&prodi=&jenis=&smt=` | Schedule rows for a context as JSON |
| `GET /api/export/[table]?prodi=` | xlsx export of a master table (drops `prodi` and `jadwal_token` columns) |
| `GET /api/import/[table]/template` | xlsx import template, generated from the live column definition + one example row |

### 4.7 Shared modules (`src/lib`)

| Module | Responsibility |
|---|---|
| `clash.ts` | Pure clash engine: time overlap, week parity, dosen/kelas/ruangan findings, cross-prodi orientation, slot clashes, SKS load. |
| `sesi-generator.ts` | Generates session slots from settings (minutes/SKS, recess, start times); flags midnight crossing. |
| `week.ts` | Week math: `mondayOf`, `addDays`, `weekDays`, `eventWeeks`, `defaultWeek`, labels. |
| `calendar-layout.ts` | Column layout for overlapping timed events in a week grid. |
| `ics.ts` | RFC 5545 ICS serializer (Asia/Jakarta, 75-octet folding, escaping). |
| `hari.ts` | Indonesian day/date labels and helpers. |
| `hari-libur.ts` | Holiday fetch (`fetchHariLibur` → `{ libur, error }`) and lookups (`liburOn`, `liburSet`). |
| `prodi.ts` / `prodi-server.ts` | Prodi config (`PRODI_CONFIG`), parsing/clamping helpers; server-side access guards (`prodiParam`, `writableProdi`, `managerOnly`, `manageableProdi`). |
| `role-types.ts` / `roles.ts` | Role constants/labels, `canWrite`/`canManage`, and `loadCurrentUser` / `getCurrentUser` (cached per request). |
| `settings.ts` | Settings loader (`loadSettings` per prodi includes shared `all` rows) + typed accessors (`settingInt/Text/Bool`). |
| `audit-log.ts` | Labels and filters for the Log Aktivitas page (`TABLE_LABEL`, `parseLogFilters`, `changedFields`, `summarize`). |
| `audit-history.ts` | Table-agnostic change-history rendering: field labels, value lookup (`courses`/`lecturers`/`rooms`), identity strip, one-line summary, changed-field diff. |
| `db-error.ts` | `humanDbError()` — Postgres/PostgREST errors to Indonesian messages. |
| `print.ts` | Print helpers: `romanSemester`, `computeAngkatan`, `substituteTemplate`, signature image parsing. |
| `xlsx.ts` | Shared exceljs worksheet helpers (borders, row heights, merged text, signature images). |
| `aspose.ts` | Aspose Cells Cloud xlsx→PDF conversion (optional). |
| `foto-login.ts` | Login-photo bucket constants and fallback image. |
| `use-prodi.ts` | Client hook reading the current prodi from the route. |
| `import/` | Master-data import/export engine (`engine.ts`) and per-table definitions (`tables.ts`). |

### 4.8 UI components and design system

Shared components live in `src/components`: `AppHeader` (top bar), `HeaderNav` (per-section tabs), `WeekNav`, `TimeGrid`, `Select` (Radix), `PersonField`, `ConfirmDeleteButton`, `DownloadButtons`, `FindingsBar`, `EmptySheet`, `ResetJadwalButton`, `TextSizeController`.

The visual system is "Bilah": an Indonesian paper/ink palette (`--kertas`, `--lembar`, `--cekung`, `--garis`, `--tinta-*`, plus semantic `--biru`, `--merah-*`, `--hijau-lembut`, `--kuning*`), borders-only depth (no shadows), rem-based layout, and document-like tables. The full token list, patterns and rationale live in [`.interface-design/system.md`](.interface-design/system.md); that file is kept current with every UI addition and is the authority for new UI work.

---

## 5. Data Model

### 5.1 Conventions

- Postgres, snake_case identifiers, UUID primary keys (identity and natural keys where noted).
- Every mutable table has `created_at` / `updated_at` maintained by the `update_updated_at_column()` trigger.
- Prodi-scoped tables carry `prodi varchar(2) check in ('s1','s2')`; shared tables (`lecturers`, `rooms`, `academic_years`) do not.
- Referential actions: year → schedules/exams/defenses `ON DELETE CASCADE`; course references `RESTRICT`; room references `SET NULL`.
- Every data table has a paired audit trigger (§5.5) and RLS (§5.4).

### 5.2 Table reference

**`academic_years`** — one row per term.
- `id varchar(20)` PK (e.g. `20261`), `label` (e.g. `2026/2027 Gasal`), `is_active boolean`.
- `mulai_kuliah date`, `selesai_kuliah date` — term boundaries; they place weekly meetings on real dates in calendars and the ICS feed. `chk_academic_years_kuliah` keeps `selesai >= mulai`.

**`courses`** — Mata Kuliah.
- `kode_mk varchar(20)` PK, `nama_mk`, `sks > 0`, `smt 1..8` (S2: ≤ 4), `jenis_mk in ('A','B')`, `kurikulum` (default `'2026'`), `prodi`.
- `unique (kode_mk, prodi)` backs the composite FKs from `schedules`/`exams`, so a schedule can only use a course of its own prodi.

**`lecturers`** — Dosen.
- `kode_dosen varchar(30)` PK, `nidn`, `nama`, `gelar_depan`, `gelar_belakang` (printed name = gelar_depan + nama + gelar_belakang).
- `jadwal_token text unique` — the secret for the public schedule link (43-char base64url, set via `set_jadwal_token()`); never logged by the audit trigger.

**`rooms`** — Ruangan.
- `id uuid` PK, `nama varchar(50) unique`, `kapasitas`, `keterangan`, `active`.

**`sessions`** — daily time slots.
- `hari in ('SENIN'..'MINGGU')`, `sesi_ke`, `jam_mulai`, `jam_selesai`, `sks`, `active`, `jenis_kelas` (`reguler`/`regsus`), `prodi`.
- Generated per day/track from settings (`menit_per_sks`, `jeda_menit`, start times, recess window) by `sesi-generator.ts`; staff may edit them.

**`schedules`** — weekly class meetings.
- `academic_year_id`, `prodi`, `jenis_kelas in ('reguler','regsus')`, `semester_ke`, `kode_mk`, `kelas`, `hari`, `jam_mulai`, `jam_selesai`, `room_id` (nullable → Zoom/no room), `zoom_id`, `jumlah_mhs`, `minggu in ('setiap','ganjil','genap')`, `keterangan`.
- Clash override bookkeeping: `is_override`, `override_reason`, `override_by → auth.users`.
- `unique (academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas)`; `chk_schedules_time_range` (`jam_selesai > jam_mulai`); `chk_schedules_s2` (S2: semesters 1–4, reguler only).

**`schedule_lecturers`** — teaching team.
- `schedule_id → schedules (CASCADE)`, `kode_dosen → lecturers (CASCADE)`, `urutan`.
- `unique (schedule_id, kode_dosen)`. **Zero rows = MKWU** (no pengampu assigned).

**`exams`** — UTS/UAS rows.
- `jenis_ujian in ('uts','uas')`, `jenis_kelas`, `semester_ke`, `kode_mk`, `kelas` (letter or `GABUNGAN`).
- Scheduling columns are nullable as a group: `tanggal`, `jam_mulai`, `jam_selesai` — `chk_exams_scheduled` enforces all-or-none (`(tanggal is null) = (jam_mulai is null) and (jam_mulai is null) = (jam_selesai is null)`), so an exam row can exist before being placed.
- `room_id`, `pengawas jsonb` (array), `keterangan_ujian in ('offline','online','take_home','project','ujian_lisan')`, override bookkeeping.
- `unique (academic_year_id, jenis_ujian, jenis_kelas, semester_ke, kode_mk, kelas)`.

**`defenses`** — Prasidang & Sidang.
- `jenis in ('prasidang','sidang')`, `tanggal`, `jam_mulai`, `jam_selesai`.
- `kelompok smallint > 0` (prasidang breakout room) XOR `room_id` (sidang room) — `chk_defenses_place` also forces `penguji_eksternal = ''` on prasidang.
- Student: `npm` (digits only) + `nama_mahasiswa` + `judul_skripsi` (free text snapshot), `unique (academic_year_id, jenis, npm)`.
- Examiners: `pembimbing_kode`, `penguji_kode`, plus `penguji_eksternal_kode → lecturers` (Anggota Penguji I as a dosen, preferred) or legacy free-text `penguji_eksternal` (kept for names typed before). `chk_defenses_distinct` forbids pembimbing = penguji; `chk_defenses_eksternal_kode` keeps the dosen code and the free text mutually exclusive and distinct from the other roles.
- `link text` — defense **material** URL (Google Drive), `''` or `^https?://` only (`chk_defenses_link`).
- Override bookkeeping like schedules.

**`students`** — thesis student master.
- `npm varchar(20) unique` (digits only), `nama`, `judul_skripsi`. Used to look up a student by NPM in the defense form and importable from xlsx.

**`settings`** — key-value configuration.
- PK `(key, prodi)`, `prodi in ('s1','s2','all')`; `type in ('int','time','text','bool','image')`, `group`, `label`, `help`, `urutan`.
- Shared keys (`all`) cover clash policy and institution identity; per-prodi keys cover prodi-specific naming and schedule rules. Full reference in §7.

**`holidays`** — faculty-wide holidays.
- `id uuid`, `tanggal date unique`, `label` (1–120 chars). One row per date; managed on the Tahun Akademik page.

**`profiles`** — user roster (1:1 with `auth.users`).
- `id → auth.users (CASCADE)`, `email`, `role in ('SUPERADMIN','SCHEDULER','VIEWER')` default `VIEWER`, `prodi_access in ('s1','s2','all')` default `s1`.
- Readable by any signed-in user; **no write policy** — role changes go exclusively through service-role server actions on `/pengguna`.

**`audit_log`** — append-only change log.
- `id bigint identity`, `at`, `actor_id → auth.users (SET NULL)`, `actor_email`, `action in ('INSERT','UPDATE','DELETE')`, `table_name`, `record_id`, `old_data jsonb`, `new_data jsonb`.
- Read-only to everyone (including Super Admin); rows are written only by the trigger function. Nightly `pg_cron` job purges entries older than 1 month.

**Storage** — bucket `up_kiprat` holds login-page photos (prefix `login`, fallback image if empty) and is writable by Super Admin only (migration `20261016000001`).

### 5.3 Relationships (simplified)

```
academic_years ─┬─< schedules ─< schedule_lecturers >─ lecturers
                │        │
                │        └──── rooms
                ├─< exams >──── courses ────────┐
                │        └──── rooms           │ (prodi)
                └─< defenses >┬─ lecturers (pembimbing / penguji / eksternal)
                              ├─ rooms (sidang)
                              └─ students (by npm, logical)
profiles ── auth.users          settings (key, prodi)
holidays (standalone)           audit_log (by table_name + record_id)
```

### 5.4 Authorization model (RLS)

Two SQL helper functions gate every table's write policies, both `security definer` with a fixed `search_path`:

- `is_scheduler_or_above()` — role is `SUPERADMIN` or `SCHEDULER`.
- `is_superadmin()` — role is `SUPERADMIN`.
- `can_write_prodi(prodi)` — `SUPERADMIN`, or `SCHEDULER` whose `prodi_access` is `all` or equals the row's prodi.

| Tables | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `schedules`, `schedule_lecturers`, `exams`, `defenses` | any authenticated | `can_write_prodi(prodi)` (schedule_lecturers resolves prodi through its schedule) |
| `holidays` | any authenticated | `is_scheduler_or_above()` |
| `courses`, `lecturers`, `rooms`, `students`, `sessions`, `academic_years`, `settings` | any authenticated | `is_superadmin()` |
| `profiles` | any authenticated | — (service-role actions only) |
| `audit_log` | any authenticated | — (trigger only) |

UI mirrors the DB: `canWrite(role)` shows schedule controls, `canManage(role)` (Super Admin) shows master-data/settings/user controls. The UI check is cosmetic; RLS is the enforcement.

### 5.5 Audit trail

- `audit_row()` — a single `security definer` trigger function attached to every data table (`schedules`, `schedule_lecturers`, `exams`, `defenses`, `courses`, `lecturers`, `rooms`, `students`, `sessions`, `settings`, `academic_years`, `holidays`, …). It records actor (from `auth.uid()`), action, table, record id, and before/after JSON.
- `lecturers.jadwal_token` is stripped from both sides before writing — a token rotation is never visible in the log.
- Auth events (login/logout) are appended via the service-role client.
- Surfaced in three places:
  1. `/log-aktivitas` — filterable browser (table, action, actor, free-text search; 50 rows/page).
  2. `/log-aktivitas/riwayat?tabel=…&id=…` — per-record timeline with human values (course/lecturer/room names resolved by `audit-history.ts`), changed-field chips, and an identity strip.
  3. Hub "Perubahan Terbaru" — the last 5 entries restricted to `schedules`, `schedule_lecturers`, `exams`, `defenses`, each row deep-linking to its Riwayat page.
- Retention: nightly purge (`pg_cron`, 03:00) removes entries older than 1 month.

### 5.6 Migrations and schema evolution

- `supabase/migrations/YYYYMMDDNNNNNN_description.sql`, applied in filename order.
- Two application paths:
  - Supabase CLI: `npx supabase link … && npx supabase db push`.
  - SQL editor: paste each file (the project's de-facto production path for incremental changes) — **or** `supabase/all_in_one_setup.sql` for a fresh database. When adding a migration, append it to the all-in-one file too.
- Migration guards used throughout: `create table if not exists`, `add column if not exists`, `drop constraint if exists` + re-add, `do $$ … execute format(…) $$` loops for repetitive policy work.
- **Deploy discipline**: a deploy can reach Vercel before its migration reaches Supabase. Public surfaces are written to degrade rather than fail when a new column/table is missing (see §9.6); everything else surfaces the Postgres error inline via `humanDbError()`.

---

## 6. Domain Logic

### 6.1 Kuliah (weekly classes)

- One row per (year, prodi, jenis_kelas, semester, MK, kelas). `minggu` controls parity: `setiap` every week; `ganjil`/`genap` every other week.
- A meeting's place is a room (`room_id`) or a Zoom meeting (`zoom_id`, printed as `Zoom <id>`); both may be absent.
- Teaching team: 0+ rows in `schedule_lecturers` ordered by `urutan`; zero means MKWU.
- The board supports: live clash findings, saving with a reason when a blocking clash is overridden, "copy from previous year" (`copy-year.ts`: same term one year back, copying rows and their lecturers), and a bulk reset per year.
- Optional inputs tied to policies: `maks_mahasiswa_per_kelas`, `min_mahasiswa_pilihan` (advisory warnings).

### 6.2 Session generation

`sesi-generator.ts` (covered by `check:sesi`):

- For each active day (`hari_aktif`), starting at `jam_mulai_reguler` / `jam_mulai_regsus`, it lays out back-to-back slots of `sks × menit_per_sks` minutes separated by `jeda_menit`, skipping the `jam_istirahat_mulai`–`jam_istirahat_selesai` recess window.
- `crossesMidnight()` guards evening (regsus) generation from spilling past midnight.
- Output is a preview; committing inserts the slots as `sessions` rows (with a "replace this day" toggle that first deletes that day's rows for the prodi + track).

### 6.3 Clash engine and policies

Pure functions in `src/lib/clash.ts` (covered by `check:clash`):

- **Time overlap**: interval intersection in minutes; zero overlap is not a clash.
- **Weeks**: `weeksCollide(a,b)` — `setiap` collides with everything; `ganjil`/`genap` collide with `setiap` and themselves, never with each other.
- **Types**: `dosen` (shared lecturer incl. team teaching and MKWU), `kelas` (same prodi + jenis_kelas + semester + kelas), `ruangan` (same room). Because dosen and rooms are shared across prodi, a cross-prodi booking is caught by the same year-wide check; findings are oriented from the current prodi's point of view with an `S1 · …`/`S2 · …` tag.
- **Policies** (settings): `bentrok_dosen`, `bentrok_kelas`, `bentrok_ruangan` ∈ `{blok, peringatan, abaikan}`. A `blok` finding refuses the save unless `izinkan_override` is `ya` and a reason is supplied; the save then stores `is_override` + `override_reason` + `override_by`, and the row is marked in the UI (red ⚠).
- **Beban**: total SKS per dosen against `maks_sks_dosen`; over-limit is a warning-tier finding (`bentrok_beban` controls it).
- **Exams**: `exam-clash.ts` checks exam rows for the same slot/pengawas/room semantics.
- **Defenses**: dosen clash checks across pembimbing/penguji/eksternal (defense-vs-defense and room), plus warning-tier `mengajar` findings when a defense overlaps the examiner's kuliah teaching hours.
- Findings are also exposed as `GET /api/clashes` for live boards.

### 6.4 Ujian (UTS/UAS)

- Exam rows are per (year, jenis_ujian, jenis_kelas, semester, MK, kelas) and may be unscheduled (`tanggal is null`) — the board shows these as gaps to fill.
- Scheduling assigns date/time (all-or-none), room (or none for online/take-home), `pengawas` (an array of dosen codes), and `keterangan_ujian`.
- `take_home` exams are rendered as all-day events in the ICS feed.
- The rekap page produces the pengawas recap (`xlsx` per pengawas/date range); the cetak page the official exam sheet (`xlsx`/`pdf`).

### 6.5 Prasidang & Sidang (defenses)

- **Prasidang**: Zoom, in numbered breakout rooms (`kelompok`); examiner roles are Pembimbing Pendamping and Dosen Pembahas; no Anggota Penguji I.
- **Sidang**: physical room + Penguji Eksternal (Anggota Penguji I), Ketua Sidang, Anggota Penguji II (Pembimbing).
- The form looks students up from `students` by NPM (free text still accepted), and penguji from the dosen master (`penguji_eksternal_kode`); legacy typed names remain in `penguji_eksternal`.
- **Materi link**: an optional http(s) URL per defense, validated by `normalizeDefenseLink()` (rejects `javascript:`/`data:`/scheme-less values), labelled `Lihat Materi` for Google Drive/Docs hosts and `Buka Tautan` otherwise (`defenseLinkLabel()`). It shows on the public `/jadwal-dosen` sidang rows, rides in the ICS `description`, and is deliberately **excluded from printed sheets**.
- **Zoom on the public feed**: prasidang rows read the program's `prasidang_zoom_id` / `prasidang_zoom_passcode` settings and render `Kelompok 1 · Zoom 8123456789 · Passcode p3l`, falling back to `Kelompok 1 (Zoom)` when unset.

### 6.6 Term weeks, parity, exam pauses, holidays

The calendar/feed time model (covered by `check:jadwal-dosen`, `check:hari-libur`, `check:kalender`):

- **Week 1** is the Monday-based week containing `academic_years.mulai_kuliah`. `termWeek(date, mulai)` = 1-based term week.
- A `ganjil` class meets in odd term weeks, `genap` in even; `setiap` every week. `kuliahDates()` walks `mulai..selesai` (inclusive) with a 7- or 14-day step.
- **Exam weeks pause kuliah** per scope: if any dated UTS/UAS row of the same `prodi` + `jenis_kelas` falls in a Monday-based week, that week's kuliah meetings of that scope are removed (from the combined calendar and the ICS feed). Other programs and tracks are unaffected.
- **Hari Libur pauses all kuliah** on the exact date, faculty-wide, in both the combined calendar and the ICS feed. Exams/defenses placed on a holiday are never blocked: the entry forms (ujian and sidang) show a `--kuning` warning under the date field, and the combined calendar's day header notes `libur: <label>`. If the holidays table cannot be read, surfaces degrade as described in §9.6.

### 6.7 Public lecturer schedule (`/jadwal-dosen/[token]`)

- The token identifies the lecturer: 32 random bytes → base64url (43 chars, `^[A-Za-z0-9_-]{43}$`), stored in `lecturers.jadwal_token`, generated/rotated through the `set_jadwal_token(p_kode_dosen, p_token, p_reset)` security-definer function (Penjadwal and above).
- Token issues → 404; no enumeration hints.
- The page (no login) lists, upcoming first: the lecturer's kuliah (from `schedule_lecturers`, including team-taught classes), exams (as pengawas or pengampu; a `GABUNGAN` exam matches by MK), and defenses (as pembimbing, penguji, or anggota penguji I). Each sidang row shows peran, program, place (zoom/passcode or room) and the materi link button.
- Confidentiality: `next.config.ts` sets `X-Robots-Tag: noindex, nofollow` and `Referrer-Policy: no-referrer` on `/jadwal-dosen/*`; the page metadata is also `robots: { index: false, follow: false }`.
- Reads use the service-role client (grants on the underlying tables were added by migration `20261008000003`); the query is scoped strictly to the token's `kode_dosen`.

### 6.8 ICS calendar feed

`/jadwal-dosen/[token]/kalender.ics` (covered by `check:ics`, `check:jadwal-dosen`):

- RFC 5545 text built by `src/lib/ics.ts`: CRLF lines, 75-octet folding that never splits a UTF-8 character, proper escaping; wall-clock times in `Asia/Jakarta` (UTC+7, no DST).
- Kuliah meetings are expanded to real dates with `kuliahDates()`; skipped occurrences (exam weeks, holidays) are listed as `EXDATE`s rather than dropped silently, so subscribed clients remove them.
- Recurrence is weekly or biweekly (`repeat.weeks = 1|2`) until `selesai_kuliah`.
- Events: `Kuliah · <MK> (<kelas>) · <S1|S2>` with place as `LOCATION`, program/parity as `DESCRIPTION`; exams (`<UTS|UAS> <peran> · <MK> (<kelas>) · <S1|S2>`; take-home = all-day); defenses with the materi link in `DESCRIPTION`.
- A lecturer with no term dates gets no weekly expansion (the feed then carries only the dated exams/defenses).

### 6.9 Kalender Gabungan (`/kalender`)

- One dated week grid for a chosen academic year (`?ay=`) covering **both prodi** and all three types; there is deliberately **no filter stack** on this page — only the year selector and `WeekNav`. Per-program, per-type calendars remain for filtered deep inspection.
- Pure event building lives in `src/app/kalender/items.ts` (covered by `check:kalender`): `expandKuliah()` (parity, exam-week pause, holiday skip), `allEvents()`, `weekCounts()` (the WeekNav numbers).
- Every event badge carries its type; color keys are prefixed `K|` (kuliah), `U|` (ujian), `S|` (sidang) to stay unique across prodi; override rows keep the red ⚠ treatment.
- Day headers show `libur: <label>`; a holidays read failure renders an inline `--kuning` note and the rest of the calendar still works.

### 6.10 Master-data import / export

Applies to four tables (`src/lib/import/tables.ts`): `courses`, `lecturers`, `rooms`, `students`.

- **Template**: download → fill → upload. The template (and export) is generated from the live column definition so it cannot drift from what the importer accepts; it ships one example row.
- **Dry run**: rows are classified (new / changed / unchanged / rejected) with per-cell validation before anything is written; the preview must be confirmed.
- **Commit**: applied through the import engine with per-row error capture, so a failed row never half-applies silently.
- Exports drop technical columns (`prodi`, and `jadwal_token` for lecturers) so the file re-imports cleanly and never leaks lecturer links.
- Derived columns (e.g. course `semester` from `smt` parity) are accepted on import but not stored.

### 6.11 Print and document generation

- xlsx is built server-side with `exceljs` (`lib/xlsx.ts` helpers: borders, wrapped-row heights, merged headers, signature images); the PDF route converts the xlsx via Aspose when configured, otherwise offers the Excel download.
- The Word **Surat Penugasan** is generated with `docx` (per-dosen recap; page-fit assertions in `check:surat`).
- Documents are driven by settings: header lines (`header_baris` with `{semester}`, `{angkatan}`, `{term}`, `{tahun}` placeholders via `substituteTemplate`), footer notes (`keterangan_cetak`), signatories (nama/jabatan/gambar tanda tangan; dekan and wakil dekan roles), paper size and orientation.
- Cetak PDF/XLSX routes exist for kuliah, ujian and sidang; rekap routes for kuliah (docx) and ujian (xlsx).

### 6.12 Audit surfacing

- A change is attributed to the acting user (or, for public/token-driven changes, system actions), labelled through `TABLE_LABEL`, and rendered with human values (course names, lecturer display names, room names) everywhere it appears.
- The Riwayat page answers "what happened to this record", the Log Aktivitas page answers "what happened lately", and the hub strip answers "did anything change since I last looked".

---

## 7. Settings Reference

Settings live in the `settings` table and are edited per prodi in **Pengaturan** (shared keys appear once as the `all` tier). Groups as surfaced in the UI:

| Group | Purpose | Representative keys |
|---|---|---|
| `waktu` (Waktu & Sesi) | Session grid generation | `menit_per_sks`, `jeda_menit`, `jam_mulai_reguler`, `jam_mulai_regsus`, `jam_istirahat_mulai`, `jam_istirahat_selesai`, `hari_aktif` |
| `kelas` | Class-size advice | `kelas_maksimal`, `maks_mahasiswa_per_kelas`, `min_mahasiswa_pilihan` |
| `bentrok` | Clash policies & load | `bentrok_dosen`, `bentrok_kelas`, `bentrok_ruangan` (`blok`/`peringatan`/`abaikan`), `izinkan_override`, `bentrok_beban`, `maks_sks_dosen` |
| `cetak` | Institution identity & sheet layout | `nama_universitas`, `nama_fakultas`, `kota`, `nama_prodi`, `header_baris`, `keterangan_cetak`, `nama_penandatangan`, `jabatan_penandatangan`, `gambar_tanda_tangan`, `ukuran_kertas`, `orientasi`, `zoom_id`, `zoom_passcode` |
| `surat` | Surat Penugasan document | `nomor_surat`, `perihal_surat`, `lampiran_surat`, `catatan_perkuliahan`, `nama_dekan`, `jabatan_dekan`, `gambar_tanda_tangan_dekan`, `nama_wakil_dekan`, `jabatan_wakil_dekan` |
| `ujian` | Exam slots & invigilation | `sesi_ujian_reguler`, `sesi_ujian_regsus` |
| `sidang` | Defense slots & Zoom | `sesi_prasidang`, `sesi_sidang`, `prasidang_zoom_id`, `prasidang_zoom_passcode`, `prasidang_header_baris`, `sidang_header_baris` |

Notes:

- Term boundaries (`mulai_kuliah`, `selesai_kuliah`) are **not** settings — they live on `academic_years`.
- The canonical, always-current list is the Pengaturan page itself; seeds live in the migrations (`20260921000003_seed_initial_data.sql` onward). Some keys (`gambar_tanda_tangan*`) are `type = 'image'` and hold data URIs/URLs.

---

## 8. Security

### 8.1 Authentication

- Supabase Auth, email + password. **There is no sign-up page**; accounts are created by a Super Admin on `/pengguna` (service-role admin client) or in the Supabase dashboard. New accounts default to `VIEWER` / `prodi_access = 's1'`; the first account must be promoted to `SUPERADMIN` with a one-off SQL statement (see README).
- Session handling: cookie-based via `@supabase/ssr`; refreshed in `proxy.ts` using `getClaims()` (local JWT verification, no Auth round-trip). The gate fails closed on errors.
- `/masuk`, `/auth/callback`, `/jadwal-dosen/*` and static assets are the only unauthenticated surfaces.
- `/atur-kata-sandi` lets a user change their own password.

### 8.2 Authorization

Three layers, with the DB as the source of truth:

1. **Route gate** — proxy (session) + `[prodi]/layout.tsx` (404 unknown prodi, redirect when `prodi_access` excludes it).
2. **RLS policies** — per-table, per-action (see §5.4). Even a hand-crafted API call cannot write outside the caller's role/prodi.
3. **UI affordances** — `canWrite` / `canManage` hide controls the role cannot use.

Page-level guards on top: master-data pages and actions call `managerOnly()` / `manageableProdi()` (`prodi-server.ts`), which re-check the role server-side.

### 8.3 Public token surface

- Scope: the token resolves to exactly one lecturer; the page and feed read only rows where that lecturer appears. No write path exists through the token.
- Transport & discovery: tokens travel in the URL; configured headers (`noindex`, `no-referrer`) keep them out of search engines and prevent leaking through outbound links.
- Rotation: re-running `set_jadwal_token(..., p_reset := true)` invalidates the old URL. Tokens are excluded from the audit log, from exports (`jadwal_token` dropped), and from printed output.
- The public feed endpoints are excluded from the proxy matcher on purpose; their safety derives from the service-role query scoping above.

### 8.4 Input validation and data integrity

- Database constraints are the last line: CHECKs on enums/parities/roles/time ranges/place rules, UNIQUEs on natural keys and per-scope uniqueness, FK actions chosen per relation (§5.2).
- Server actions validate form input before hitting the DB and return `{ error }` for inline display; `humanDbError()` maps Postgres/PostgREST failures to readable Indonesian messages (e.g. duplicate keys, constraint names).
- The materi link field only accepts `http(s)` URLs (`normalizeDefenseLink`), since it renders as a `target=_blank` button on a public page.
- NPM fields accept digits only (DB-enforced `^[0-9]+$`); the sidang form looks up `students` by NPM.

### 8.5 Secrets and keys

| Secret | Exposure |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Used by `admin.ts` (never bundled to the client). |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Public by design; protected by RLS. |
| `ASPOSE_CLIENT_ID` / `_SECRET` | Server-only, used by the PDF route. |
| `lecturers.jadwal_token` | Secret URL segment; audit-stripped, export-stripped. |

---

## 9. Operations

### 9.1 Environment variables

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything |
| `SUPABASE_SERVICE_ROLE_KEY` | Pengguna page (account administration), auth audit entries, public `/jadwal-dosen` reads, storage management |
| `ASPOSE_CLIENT_ID`, `ASPOSE_CLIENT_SECRET` | PDF downloads on print pages (free tier: 150 conversions/month); without them the xlsx download still works |

`.env.example` documents the shape; `.env.local` holds real values locally.

### 9.2 Local development

```bash
npm install
cp .env.example .env.local     # fill in
npm run dev                    # http://localhost:3000
npm run lint                   # eslint
npx tsc --noEmit               # type check
npm run check                  # 20 pure-logic suites
npm run build                  # production build (also type-checks scripts/)
```

Conventions that keep the codebase consistent (validated by experience, see `AGENTS.md`):

- Read the bundled Next.js 16 docs before writing framework code; the file conventions (`proxy.ts`, typed `PageProps`/`RouteContext`) differ from older versions. New routes need `npx next typegen`.
- Keep business rules in pure modules (`src/lib`, `*.ts` next to pages) and pin them with a `check:*` suite.
- In check scripts, use named test functions instead of bare `{ … }` blocks (bare blocks have caused spurious `tsc` parse errors in this repo).
- UI text is Indonesian; code, comments and these docs are English.

### 9.3 Verification suites

`npm run check` runs 20 suites in sequence (Node `assert`, executed with `tsx`):

| Suite | Covers |
|---|---|
| `check:sesi` | Session generator: slot math, recess window, regsus evening fits, midnight crossing |
| `check:clash` | Clash engine: overlaps, week parity, all three clash types, cross-prodi orientation, load limits, exam slot clashes, free rooms |
| `check:print` | Kuliah schedule sheet xlsx build (cell/merge assertions on the generated file) |
| `check:calendar` | Week helpers and overlapping-event layout in week grids |
| `check:surat` | Surat Penugasan docx generation and page fitting |
| `check:ujian` | Exam row building and the exam export |
| `check:sidang` | Defense time blocks and the defense document |
| `check:prodi` | Prodi parsing/access/clamping and import row classification |
| `check:import` | Import engine: parsing, validation classes, template/export buffers |
| `check:jadwal-dosen` | Term-week math, `kuliahDates`, feed event assembly (incl. exdates), prasidang zoom label |
| `check:proxy` | Session gate: route skipping, redirects, fail-closed behavior |
| `check:settings` | Settings loading (prodi + `all`), typed accessors, active-day parsing |
| `check:roles` | `loadCurrentUser` role/prodi resolution |
| `check:ics` | RFC 5545 escaping, folding, calendar text |
| `check:tahun-akademik` | Academic-year save sequencing (each write recorded, one failure simulated) |
| `check:copy-year` | Rollover copy: previous-year resolution, copied rows/lecturers |
| `check:audit-log` | Log filters parsing and free-text search filtering |
| `check:defense-link` | Material-link normalization and labelling |
| `check:hari-libur` | Holiday→kuliah skipping in the combined calendar and the feed |
| `check:kalender` | Combined-calendar event building: parity, exam pauses, holidays, week counts |

Separately, `npm run check:db` starts a throwaway PostgreSQL 16 container, applies **every migration** and runs `scripts/check-prodi-db.sql` — SQL-level assertions for the RLS policies (roles and prodi access) that the TS suites cannot see. It requires Docker.

### 9.4 Migrations and deployment

1. Write the migration in `supabase/migrations/` and append it to `supabase/all_in_one_setup.sql`.
2. Apply it to production **before or immediately with** the deploy — in this project, by pasting the file into the Supabase SQL editor (or `supabase db push` when using the CLI).
3. Deploy the app (Vercel, connected to the repository).
4. Smoke-check `/jadwal-dosen/<token>` after schema changes; a 500 there historically meant a migration lagging the code.

### 9.5 Failure-mode notes (schema lag resilience)

Because migrations are applied by hand, the codebase deliberately degrades instead of failing when a new object is missing:

| Surface | If the new object is missing | Behavior |
|---|---|---|
| Public lect. feed | `holidays` table | Feed loads; kuliah simply not skipped on holidays |
| Public lect. feed | `defenses.link` column | Feed refetches defense rows without `link`; rows render without materi buttons |
| `/kalender` | `holidays` table | Calendar loads with an inline `--kuning` note; no holiday skips |
| Admin ujian/sidang forms | `holidays` table | Warning line absent; save unaffected |
| Other pages | any schema error | Inline `humanDbError()` message (or error boundary for load failures) |

Rule of thumb: **public, read-only surfaces must never 500 over an enhancement**; admin surfaces may show the underlying error because a human is present to act on it.

### 9.6 Observability

- `audit_log` is the primary behavioral record (who changed what, when), with UI surfacing in §5.5.
- `humanDbError()` turns raw Postgres failures into actionable Indonesian text wherever an operation can fail.
- Vercel function logs capture server-side exceptions; the app itself has no APM integration.

---

## 10. Constraints, Assumptions and Future Work

### 10.1 Constraints and assumptions

- **Timezone**: scheduling times are wall-clock `Asia/Jakarta`; no DST handling (none needed).
- **Scale**: a few thousand rows per academic year; no caching layer, no partitioning, direct Postgres reads.
- **Single faculty / two programs**: prodi is a data dimension with fixed config in `prodi.ts` (`semesters`, `jenisKelas`, defense labels). A third program would extend that config plus the prodi check constraints.
- **Manual production migrations**: the main operational risk; mitigated by §9.5.
- **Aspose free tier**: 150 PDF conversions per month; the xlsx download is the always-available fallback.
- **No sign-up, no password reset UI**: accounts are admin-created; password changes are self-service via `/atur-kata-sandi`.
- **Audit retention**: 1 month (nightly pg_cron purge). Longer retention would need a change to the retention migration.
- **`next build` type-checks `scripts/`**: a broken check script fails the build, not just `npm run check`.

### 10.2 Future work (candidates, not commitments)

- Optional UI for rotating/revoking lecturer tokens per dosen (the SQL function exists; the Dosen page exposes generate/copy today).
- Bulk operations on the combined calendar (it is read-only by design).
- Automatic conflict solving — out of scope until product requirements demand it.
- Per-program holiday overrides (today holidays are faculty-wide by definition).
- Extending import/export to more tables as master data grows.

---

## Appendix A — Recent feature notes (for orientation)

These behaviors are recent and worth knowing when reading the code:

- **Riwayat Perubahan**: `/log-aktivitas/riwayat?tabel=…&id=…`; helpers in `src/lib/audit-history.ts`; entry point from the Log Aktivitas detail modal and from the hub strip.
- **Materi link** on defenses: DB `chk_defenses_link`, form validation `normalizeDefenseLink`, render `defenseLinkLabel`, public page button ("Lihat Materi" on Drive hosts), ICS `description`; intentionally absent from Cetak.
- **Kalender Gabungan**: `/kalender` (no filters, year + week navigation), pure builder in `src/app/kalender/items.ts`. Note: this path must not be added to legacy redirects.
- **Hari Libur**: `holidays` table + `src/lib/hari-libur.ts`; kuliah skips in feed/calendar, ujian/sidang form warnings; management UI on `/tahun-akademik`.
- **Perubahan Terbaru**: hub strip of the last 5 audit entries limited to the four schedule tables (`schedules`, `schedule_lecturers`, `exams`, `defenses`), each linking to Riwayat.
- **Prasidang Zoom on the public feed**: `Kelompok N · Zoom <id> · Passcode <passcode>` from `prasidang_zoom_*` settings; falls back to `Kelompok N (Zoom)`.

## Appendix B — Document history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-17 | Initial TSD, written against the working tree that includes Kalender Gabungan, Hari Libur, Riwayat Perubahan, the materi link and the public-feed hardening. |
