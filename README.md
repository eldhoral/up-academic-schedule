# KRS Scheduling — S1 Psikologi & S2 Psikologi Profesi, Universitas Pancasila

An internal admin tool for building the study program's three schedules each academic year, catching clashes before they happen, and printing the official documents:

1. **Jadwal Mata Kuliah & Dosen** (`/s1/kuliah`, `/s2/kuliah`) — weekly classes per semester and kelas, for Reguler and Reguler Khusus. Prints the schedule sheet and the per-dosen recap / Surat Penugasan.
2. **Jadwal UTS & UAS** (`/s1/ujian`, `/s2/ujian`) — exam date, time, ruangan, pengawas and keterangan (Offline, Online, Take Home, Project, Ujian Lisan) per mata kuliah. Prints the exam schedule and the pengawas recap.
3. **Jadwal Prasidang & Sidang** (`/s1/sidang`, `/s2/sidang`) — thesis defenses with students, penguji and rooms. Prints the defense schedule.

S1 and S2 each have the three schedules, under `/s1/...` and `/s2/...` (S2's third is Jadwal Seminar Proposal & Tesis). Dosen, Ruangan and Tahun Akademik are shared. A dosen or room booked in both prodi at the same hour is a clash on both sides.

Each schedule has a calendar view and a live clash check (dosen/pengawas, ruangan, kelas). Each clash type can be set to block, warn or be ignored in Pengaturan, and a blocked save can be overridden with a written reason.

The UI is in Indonesian. The design rationale and data model are in [`PLAN.md`](PLAN.md); the visual system is in [`.interface-design/system.md`](.interface-design/system.md).

## Stack

- Next.js 16 (App Router, server actions). This version differs from older Next.js; see `AGENTS.md` and `node_modules/next/dist/docs/`. The session gate is `src/proxy.ts`, not `middleware.ts`.
- Supabase Postgres and Supabase Auth (email and password), using `@supabase/ssr`. Row Level Security is enabled on every table.
- Tailwind CSS 4.
- `exceljs` for Excel import and export, `docx` for the Surat Penugasan.
- Aspose Cells Cloud for xlsx-to-PDF conversion (optional).

## Getting started

Requires Node 22 or newer and a Supabase project.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything |
| `SUPABASE_SERVICE_ROLE_KEY` | The Pengguna page (create and delete accounts, change roles) and the login/logout entries in the audit log. Server-only; never expose it to the browser. |
| `ASPOSE_CLIENT_ID`, `ASPOSE_CLIENT_SECRET` | "Unduh PDF" on the print pages. The free tier allows 150 conversions a month. Without these, the Excel download still works. |

### Database

Apply every file in `supabase/migrations/`, in order:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

The migrations create the schema, RLS policies, roles and settings, and seed data: the 2026 curriculum, the 2026/2027 Gasal schedule, and the 2025/2026 Gasal UTS and sidang.

Without the CLI, paste `supabase/all_in_one_setup.sql` into the Supabase SQL editor and run it. It is every migration joined into one file, so whenever you add a migration, append it there too. It is for a fresh database only: an existing project applies just the new migration files, `supabase/migrations/20261007000001_prodi.sql`, `supabase/migrations/20261008000001_header_line_breaks.sql` and `supabase/migrations/20261008000002_s2_reguler_malam.sql`.

### First account

There is no sign-up page. Create the first user in the Supabase dashboard (Authentication → Users). New accounts start as `VIEWER`, so promote the first one in the SQL editor:

```sql
update profiles set role = 'SUPERADMIN' where email = 'you@example.com';
```

SUPERADMIN implies Akses Prodi Semua.

After that, manage accounts from **Manajemen Pengguna** (`/pengguna`).

| Role | Can |
|---|---|
| `SUPERADMIN` (Super Admin) | Everything, including managing users |
| `SCHEDULER` (Penjadwal) | Read and write schedules and master data |
| `VIEWER` (Pemantau) | Read only |

Every account also has an **Akses Prodi** (S1, S2 or Semua; Super Admin is always Semua). It decides which prodi's menu the account sees and which prodi's data it may change.

| Akses Prodi | Menu and writes |
|---|---|
| S1 | S1 menu; S1 data only |
| S2 | S2 menu; S2 data only |
| Semua | Both prodi |

Akses Prodi is set per account in **Manajemen Pengguna**. Shared data (Dosen, Ruangan, Tahun Akademik) is editable by any Penjadwal, whatever the Akses Prodi. Shared Pengaturan (clash policies, university/faculty/dekan) needs Semua.

## Using it

1. In **Data Master**, set up each prodi's Mata Kuliah, Mahasiswa (for prasidang/sidang or seminar/tesis), Sesi and Pengaturan (clash policies, print header, signatories), and the shared Data Bersama: Dosen, Ruangan and Tahun Akademik. Mata Kuliah, Dosen, Ruangan and Mahasiswa can be imported from Excel: download the template, or export the current data, fill it in, upload it, check the dry-run preview, then commit.
2. Set the active academic year in **Tahun Akademik** and generate the time slots in **Sesi**.
3. Build the kuliah schedule in `/s1/kuliah` or `/s2/kuliah`.
4. In `/s1/ujian` or `/s2/ujian`, copy the kuliah classes in as exam rows. Kelas taught only on Zoom start as Online. Then fill in the date, time, ruangan and pengawas.
5. Print from each section's **Cetak** tab. Changes are recorded in the **Audit Log**.

## Scripts

```bash
npm run dev           # development server
npm run build         # production build
npm run lint          # eslint
npx tsc --noEmit      # type check
npm run check:prodi   # prodi config and access rules
npm run check:import  # Excel import/export parsing
npm run check:proxy   # login redirect fails closed
npm run check:settings # settings query skips signature images unless asked
npm run check:roles   # current user from JWT claims
npm run check:db      # needs Docker: applies every migration to a throwaway Postgres, checks the prodi schema and RLS
```

The logic that matters (session generator, clash detection, print layout, calendar layout, letter fitting, exam and defense rows) has small assert-based checks. Each prints a line when it passes:

```bash
npm run check:sesi
npm run check:clash
npm run check:print
npm run check:calendar
npm run check:surat
npm run check:ujian
npm run check:sidang
```

## Project layout

```
src/
  app/
    page.tsx            Menu: the three schedules and their status
    [prodi]/            Everything per prodi, served as /s1/... and /s2/...
      kuliah/             Class schedule: list, kalender, cetak, rekap (Surat Penugasan)
      ujian/              UTS/UAS: list, kalender, cetak, rekap pengawas
      sidang/             Prasidang & Sidang (S1) / Seminar Proposal & Tesis (S2)
      mata-kuliah/ mahasiswa/ sesi/ pengaturan/   Data Master per prodi
    dosen/ ruangan/ tahun-akademik/   Data Bersama (shared by S1 and S2)
    pengguna/           User management (SUPERADMIN)
    log-aktivitas/      Audit log
    masuk/              Login
    api/                Excel import/export, clash and schedule endpoints
  lib/                  Supabase clients, prodi config, settings, clash and time helpers, Excel import, Aspose
  proxy.ts              Session gate for every route except the login page
supabase/migrations/    Schema, RLS, roles, seed data
scripts/                check:* scripts
docs/                   Source material from the faculty (templates, past schedules, requirements)
desain/                 HTML design mockups
```
