# KRS Scheduling — Technical Specification Document

|  |  |
|---|---|
| **System** | KRS Scheduling (Penjadwalan Akademik) — Fakultas Psikologi, Universitas Pancasila |
| **Document** | Technical Specification Document (TSD) |
| **Version** | 1.3 |
| **Date** | 14 November 2026 |
| **Status** | Describes the current working tree |
| **Audience** | Developers, maintainers, and technical reviewers of the system |
| **Related documents** | [`README.md`](README.md) (getting started) · [`PLAN.md`](PLAN.md) (original design rationale) · [`.interface-design/system.md`](.interface-design/system.md) (visual system "Bilah") · [`AGENTS.md`](AGENTS.md) (Next.js agent rules) · [`supabase/README.md`](supabase/README.md) |

---

## 1. Purpose and Scope

### 1.1 What the system is

KRS Scheduling is an internal web application (staff, plus dosen and day-login external examiners who grade their own students) used by the Faculty of Psychology (Fakultas Psikologi) of Universitas Pancasila to build and maintain the academic schedules of its two study programs:

- **S1 Psikologi** — 8 semesters, Reguler and Reguler Khusus classes.
- **S2 Psikologi Profesi** — 4 semesters, Reguler only.

For each program and academic year the system maintains three schedules:

1. **Jadwal Kuliah** — weekly classes per semester and kelas, with lecturers (including team teaching), room or Zoom, and odd/even-week parity.
2. **Jadwal UTS/UAS** — exam date, time, room, pengawas (invigilators) and exam mode (Offline, Online, Take Home, Project, Ujian Lisan).
3. **Jadwal Prasidang & Sidang** — thesis defenses. S1: Prasidang & Sidang Skripsi; S2: Seminar Proposal & Sidang Tesis.

Around those three schedules the system provides: live clash detection with configurable policies, overrides with recorded reasons, Excel import/export of master data, printable official documents (Excel and PDF, plus a Word Surat Penugasan), a combined calendar, a per-lecturer secret-link schedule with an `.ics` calendar feed, faculty-wide holidays, online grading of S1 prasidang by the dosen pembimbing (Nilai Bimbingan) and of S1 sidang by its three examiners (Nilai Sidang, Nilai Akhir, revisi email), and a full audit trail.

### 1.2 In scope

- CRUD and import/export of master data: Mata Kuliah, Dosen, Ruangan, Mahasiswa, Sesi, Tahun Akademik.
- Scheduling and clash-checking of kuliah, exams and defenses.
- Printing/exporting the official schedule documents and per-lecturer recaps.
- Public read-only views for lecturers (token URL + calendar feed).
- Nilai Bimbingan: online grading of S1 prasidang by the two dosen pembimbing, configurable grading rules, a recap with Excel export (§6.13).
- Nilai Sidang and Nilai Akhir: online grading of S1 sidang by Ketua, Anggota Penguji I and II, the Ketua's yudisium and lock, Nilai Akhir / IPK after sidang / predikat, a revisi email via Gmail SMTP, a recap with Excel export, and temporary day logins for external examiners (§6.14).
- Role-based access: Super Admin, Penjadwal (scheduler), Pemantau (viewer), Dosen and Penguji Eksternal (own grading pages only).
- Audit trail of every data change, with a change-history viewer.

### 1.3 Out of scope

- Student-facing features (students do not log in; KRS submission itself is not part of this tool).
- Automatic schedule optimization/solving — all placements are made by staff; the system only detects and reports conflicts.
- Multi-faculty tenancy — the deployment serves one faculty with two study programs.
- Integration with external academic systems (SIAKAD, LMS); the only public surface is the lecturer link.
- Grading at S2 (Seminar Proposal, Sidang Tesis): online grading is S1 only.
- Printing the berita acara or the revisi form, tracking whether a student completed the revisi, re-sending the revisi email after a Super Admin correction, and self-service password reset for day logins (an admin makes a new password instead).

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
| **Nilai Bimbingan** | S1 supervision grade: the average of the two dosen pembimbing's scores for one prasidang, converted to a letter. |
| **Dospem I / II** | Dosen Pembimbing I = Pembimbing Pendamping (`defenses.pembimbing_kode`, peran `pembimbing_1`); Dosen Pembimbing II = Dosen Pembahas (`defenses.penguji_kode`, peran `pembimbing_2`). |
| **Aspek** | One graded criterion with a bobot (%) and guidance sub-points. The list is a rule, edited in Pengaturan Penilaian. |
| **Tabel Nilai** | Score → letter → bobot mutu table (`A` ≥ 80 by default). A rule, edited in Pengaturan Penilaian. |
| **Nilai lama** | A grade of a prasidang dated before `tanggal_mulai_penilaian`: Super Admin may enter it from the old xlsx (`sumber = 'manual'`). |
| **IPK sebelum sidang** | `bobot_sebelum / sks_sebelum` of a student, derived and never stored. |
| **Ketua / Anggota I / Anggota II** | The three examiners of an S1 sidang: Ketua Sidang = `defenses.penguji_kode` (peran `ketua`), Anggota Penguji I = `penguji_eksternal_kode` (`anggota_1`), Anggota Penguji II = `pembimbing_kode` (`anggota_2`). |
| **Nilai Sidang** | The average of the three examiners' scores for one sidang. |
| **Nilai Akhir** | `(Nilai Bimbingan + Nilai Sidang) / 2`, only for a `lulus` yudisium and a complete Nilai Bimbingan; feeds IPK after sidang and predikat. |
| **Yudisium** | The Ketua's verdict, one of the configured `pilihan_yudisium` (each marked lulus or not). |
| **Hasil sidang** | The lock: one `hasil_sidang` row per sidang, written when the Ketua submits their grade. It freezes the rules and starts the revisi email. |
| **Penguji Eksternal** (`EKSTERNAL`) | A temporary day login for an external Anggota Penguji I: one per (dosen, sidang date), valid through `berlaku_sampai` (default sidang date + 1). |

---

## 3. System Context

### 3.1 Actors

| Actor | Role in the system | Access |
|---|---|---|
| **Super Admin** (`SUPERADMIN`) | Faculty IT/administration | Everything: master data, settings, users, all prodi schedules |
| **Penjadwal** (`SCHEDULER`) | Scheduling staff | Writes kuliah/ujian/sidang rows within their `prodi_access`; reads everything |
| **Pemantau** (`VIEWER`) | Read-only staff | Reads everything; no writes |
| **Dosen (lecturer)**, link only | No login. Holds a secret link | Reads only their own schedule page and `.ics` feed |
| **Dosen** (`DOSEN`) | A lecturer with their own login, linked to one `lecturers.kode_dosen` (never an `eksternal` lecturer) | Penilaian Saya, the grading pages of their own S1 prasidang and sidang students, and changing their password. No staff page, export or data (§8.2) |
| **Penguji Eksternal** (`EKSTERNAL`) | A temporary day login for an external examiner (a `lecturers.eksternal` dosen), made by the system, never by hand | Penilaian Saya (that day's sidang only) and the sidang grading page of those students. No password page, no bimbingan, no staff page (§6.14, §8.2) |
| **Supabase** | Platform | Postgres, Auth, Storage, Row Level Security |
| **Vercel** | Hosting | Runs the Next.js app (production: `up-academic-schedule.vercel.app`) |
| **Aspose Cells Cloud** | Optional external service | Converts generated xlsx to PDF (free tier: 150 conversions/month) |
| **Gmail SMTP** | Optional external service | Sends the revisi email of a locked sidang from `akademik.psikologi10@gmail.com` (`smtp.gmail.com:465`); setup in §9.7 |

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
                     │   pg_cron: nightly audit_log purge, expired   │
                     │   EKSTERNAL account purge                     │
                     └──────────────────────────────────────────────┘
```

The public lecturer pages bypass the session gate but read through the **service-role** client, scoped to the token's lecturer only. Mail goes out directly from the app server over Gmail SMTP (nodemailer), never from the database.

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
| Email | `nodemailer` over Gmail SMTP (optional) | The only mail path: the Nilai Sidang revisi email. Without `SMTP_*` the send is recorded as `gagal` and nothing else breaks (§9.7). |
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
   - Skips: `/_next/*`, `/auth/*`, `/jadwal-dosen/*` (public), `/favicon.ico`. Images (svg/png/jpg/jpeg/gif/webp) never reach the proxy (matcher). Other extensions are **not** skipped, so a dynamic segment such as `/api/export/x.pdf` still needs a login and the DOSEN gate.
   - If env vars are missing/placeholder: pass through (allows local start without Supabase).
   - Unauthenticated users on any other path → redirect to `/masuk?redirectTo=<path>`.
   - Authenticated users on `/masuk` → redirect to `redirectTo` or `/`.
   - **Fails closed**: if the auth check throws, the request is redirected to `/masuk`.
   - Uses `auth.getClaims()` — local JWT verification with asymmetric signing keys.
   - **Examiner gate** (deny by default): for a signed-in user on any path outside the EKSTERNAL list of `halamanDosen(path, role)`, the proxy reads the caller's `profiles.role` and `berlaku_sampai` (one query per such request). The DOSEN list is `/penilaian`, `/atur-kata-sandi`, `/nilai-bimbingan/<id>` and `/nilai-sidang/<id>`; the EKSTERNAL list is the narrower `/penilaian` and `/nilai-sidang/<id>` (no password page: an admin sets its password; no bimbingan). A DOSEN or EKSTERNAL is redirected to `/penilaian` on GET/HEAD and gets 403 on any other method (a staff server action's POST). A new staff page, export route or action is therefore closed to both without extra work. A failed role read answers 503, not a redirect to `/masuk`, which a signed-in user is sent straight back from.
   - **Expired EKSTERNAL**: when the role read shows an EKSTERNAL past `berlaku_sampai` (Jakarta date), the proxy signs it out and redirects to `/masuk`. On `/masuk` itself a signed-in expired EKSTERNAL is signed out too, so it cannot bounce between `/masuk` and its pages. On its own pages the proxy does no role read (they are on its list), so there `loadCurrentUser` returns null for an expired account and the page redirects it away (Penilaian Saya to `/`, the grading page to `/masuk`), where the gate above signs it out.
2. **`src/app/[prodi]/layout.tsx`** — `parseProdi()` (unknown → 404), session check, and `canAccessProdi(user.prodiAccess, prodi)` (no access → `/`).
3. **Page** — server component loads data with the RLS-scoped client and renders.
4. **Config redirects** (`next.config.ts`) run *before* proxy and the filesystem: they preserve pre-S2 bookmarks (`/kuliah → /s1/kuliah`, `/ujian → /s1/ujian`, etc.). `/kalender` is deliberately **not** redirected — it is the Kalender Gabungan (§6.9).

New routes require `npx next typegen` so the typed `PageProps<'/route'>` / `RouteContext<'/route'>` helpers resolve.

### 4.4 Supabase clients

| File | Kind | Used for |
|---|---|---|
| `src/lib/supabase/server.ts` | SSR client with cookies (anon key) | All normal page/action reads and writes — **RLS applies as the logged-in user** |
| `src/lib/supabase/client.ts` | Browser client | Rare client-side auth flows (e.g. change password) |
| `src/lib/supabase/admin.ts` | Service-role client | Privileged server-only operations: the Pengguna page (create/delete accounts, change roles), login/logout audit entries, the public `/jadwal-dosen` reads, the grading pages' defense/student reads (`loadPenilaian`, `loadSidang`, Penilaian Saya), which run only after the role and access checks, the day-account actions (create, new password, Perpanjang), and the revisi email's reads and its `email_status` write (`mailer.ts`). Bypasses RLS — never import from client code. |
| `src/lib/supabase/proxy.ts` | Session refresh inside `proxy.ts` | Cookie refresh + route gating |

### 4.5 Route map

**Shared / top level**

| Route | Purpose | Who |
|---|---|---|
| `/` | Hub: per-prodi status tallies, nav | Signed-in |
| `/kalender` | Kalender Gabungan — one week grid, both prodi, all schedule types | Signed-in |
| `/dosen` | Lecturer master data (incl. email, Dosen eksternal) + import/export | Super Admin writes; staff read |
| `/ruangan` | Room master data | Super Admin writes |
| `/tahun-akademik` | Academic years (term dates) + **Hari Libur** management | Super Admin |
| `/pengguna` | User accounts, roles (incl. Dosen + dosen picker), prodi access, **Atur ulang kata sandi** | Super Admin (service-role actions) |
| `/log-aktivitas` | Audit log browser (filters, paging) | Signed-in |
| `/log-aktivitas/riwayat?tabel=…&id=…` | Per-record change history (timeline + diff) | Signed-in |
| `/masuk` | Login | Public |
| `/atur-kata-sandi` | Change own password | Signed-in (incl. Dosen; not Penguji Eksternal) |
| `/penilaian` | **Penilaian Saya** — a Dosen's S1 prasidang and sidang in every year, or a Penguji Eksternal's sidang of its day, with status (Belum dibuka / Belum dinilai / Menunggu anggota / Terkirim / Terkunci) | Dosen, Penguji Eksternal |
| `/nilai-bimbingan/[defenseId]` | Grading form for one S1 prasidang: a Dosen grades their own peran; Super Admin sees and edits both; Penjadwal/Pemantau read | Dosen (own prasidang), staff |
| `/nilai-sidang/[defenseId]` | One S1 sidang: an anggota grades their own peran; the Ketua sees both anggota, grades, picks the yudisium and locks; Super Admin sees and edits all three and the yudisium (and enters old grades); Penjadwal/Pemantau read | Dosen / Penguji Eksternal (own sidang), staff |
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
| `/[prodi]/sidang/nilai-bimbingan` | Nilai Bimbingan recap per tahun akademik + Excel download (S1 only; `s2` → 404) |
| `/[prodi]/sidang/nilai-akhir` | Nilai Akhir recap per tahun akademik (Nilai Sidang, yudisium, Nilai Akhir, IPK, predikat, email status) + Excel download, "Kirim ulang email" for Super Admin (S1 only; `s2` → 404) |
| `/[prodi]/sidang/akun-eksternal` | **Akun Penguji Eksternal** — one card per day login: dosen, date, username, that day's students, expiry; "Buat password baru", "Perpanjang" (S1 only; Super Admin and Penjadwal with S1 access, others 404) |
| `/[prodi]/mata-kuliah` | Course master data + import/export |
| `/[prodi]/mahasiswa` | Student master (NPM, nama, judul, email, SKS/bobot sebelum sidang, derived IPK, tepat waktu) + import/export |
| `/[prodi]/sesi` | Session slot management (generated from settings, editable) |
| `/[prodi]/pengaturan` | Settings for this prodi (+ shared `all` tier) |
| `/[prodi]/pengaturan/penilaian` | Pengaturan Penilaian S1: the seven grading rules (S1 only, Super Admin; others → 404) |

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
| `GET /api/nilai-bimbingan?year=` | Nilai Bimbingan recap of one tahun akademik as xlsx (`year` = `academic_years.id`, default the active year). 401 signed out; 403 for a Dosen or an account without S1 access |
| `GET /api/nilai-akhir?year=` | Nilai Akhir recap of one tahun akademik as xlsx, same parameters and refusals (403 for a Dosen, a Penguji Eksternal, or an account without S1 access) |

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
| `role-types.ts` / `roles.ts` | Role constants/labels, `canWrite`/`canManage`/`isDosen`/`isPenguji` (DOSEN or EKSTERNAL), and `loadCurrentUser` / `getCurrentUser` (cached per request; carries `kodeDosen` and `berlakuSampai`; `kodeDosen` is set for a DOSEN or EKSTERNAL, whose `prodiAccess` is always `s1`; an expired EKSTERNAL resolves to null, i.e. signed out). |
| `settings.ts` | Settings loader (`loadSettings` per prodi includes shared `all` rows) + typed accessors (`settingInt/Text/Bool`). |
| `audit-log.ts` | Labels and filters for the Log Aktivitas page (`TABLE_LABEL`, `parseLogFilters`, `changedFields`, `summarize`). |
| `audit-history.ts` | Table-agnostic change-history rendering: field labels, value lookup (`courses`/`lecturers`/`rooms`), identity strip, one-line summary, changed-field diff. |
| `db-error.ts` | `humanDbError()` — Postgres/PostgREST errors to Indonesian messages (incl. the dosen-lock trigger, the "prasidang/sidang sudah dinilai" delete refusals, matched by FK constraint name only, an invalid yudisium pair, and the "Nilai sidang sudah dikunci" race). |
| `password.ts` | `generatePassword(length = 12)` — characters from an alphabet without `0 O 1 l I`, via `crypto.randomInt`; used by the admin password reset (12) and the day logins (10, via `passwordAcak`). |
| `mailer.ts` | The revisi email: `smtpTransport()` (Gmail from `SMTP_USER`/`SMTP_PASS`/`SMTP_FROM`, 10 s timeouts), `kirimRevisi()` (recipients, send, outcome onto `hasil_sidang`). The only code that sends mail. |
| `print.ts` | Print helpers: `romanSemester`, `computeAngkatan`, `substituteTemplate`, signature image parsing. |
| `xlsx.ts` | Shared exceljs worksheet helpers (borders, row heights, merged text, signature images). |
| `aspose.ts` | Aspose Cells Cloud xlsx→PDF conversion (optional). |
| `foto-login.ts` | Login-photo bucket constants and fallback image. |
| `use-prodi.ts` | Client hook reading the current prodi from the route. |
| `import/` | Master-data import/export engine (`engine.ts`) and per-table definitions (`tables.ts`). |
| `penilaian/aturan.ts` | Grading rules: types, `validateAspek/TabelNilai/Predikat/PilihanYudisium/Sks/Tanggal`, `DEFAULT_ATURAN`, `loadAturan()`, and the frozen copy (`AturanBeku`, `bekukan`, `parseAturanBeku`) (§6.13, §6.14). |
| `penilaian/nilai.ts` | Grading math and parsing: `round2`, `parseAngka`, `nilaiDariSnapshot`, `nilaiBimbingan`, `nilaiSidang`, `baris` (letter lookup), `ipkSebelum`, `ipkSetelah`, `predikat`, `hasilAkhir`, `aspekSama`, `snapshotDariSkor`, `cekRevisi`. |
| `penilaian/akses.ts` | Access rules: `peranDosen`, `aksesDosen`, `bisaDinilai`, `bolehInputLama`, `todayJakarta`, `halamanDosen(path, role)` (the examiner allowlist) and, for sidang, `peranPenguji`, `aksesSidang`, `bisaDinilaiSidang`, `bolehInputLamaSidang`, `eksternalAktif`. |
| `penilaian/data.ts` | `loadPenilaian(defenseId)`: one S1 prasidang with both grades, rules and the student's IPK (service-role); `loadSidang(defenseId)`: one S1 sidang with its grades, the lock and the rules; `identitasPenguji(user)`: the examiner's kode and, for an EKSTERNAL, its account day. |
| `penilaian/rekap.ts` / `rekap-data.ts` / `rekap-xlsx.ts` | Recap rows (pure `buildRekapBimbingan`, `buildRekapAkhir`, `bimbinganTerbaru`, `bolehKirimUlang`), the loaders + tahun picker (`loadRekapBimbingan`, `loadRekapAkhir`, `pilihTahun`), and the xlsx builders. |
| `penilaian/email-revisi.ts` | `renderRevisi()`: subject, plain text and HTML of the revisi email. Grades are never part of it. |
| `penilaian/akun-eksternal.ts` | Day logins: `usernameEksternal`, `passwordAcak`, `emailLogin` (appends `@penguji.local`), `ensureAkunEksternal()` (create-once per dosen and date). |

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
- `email text not null default ''` (empty or `^[^@\s]+@[^@\s]+\.[^@\s]+$`) and `eksternal boolean not null default false` (a non-permanent "Dosen eksternal": never gets a DOSEN account and may only be Anggota Penguji I, §6.5).

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
- Trigger `lock_graded_defense` (before update of `pembimbing_kode`, `penguji_kode`, `penguji_eksternal_kode`, `tanggal`, `npm`, `jenis`, `prodi`; last defined in `20261116000001`) rejects:
  - prasidang: changing `pembimbing_kode` once a `pembimbing_1` grade exists, and `penguji_kode` once a `pembimbing_2` grade exists ("Dosen pembimbing tidak dapat diubah: prasidang ini sudah dinilai.");
  - sidang: changing `penguji_kode` once a `ketua` grade exists, `penguji_eksternal_kode` once `anggota_1` exists, `pembimbing_kode` once `anggota_2` exists, and `tanggal` once any `nilai_sidang` row exists ("Penguji/tanggal tidak dapat diubah: sidang ini sudah dinilai.");
  - either jenis: changing `npm`, `jenis` or `prodi` once a `nilai_bimbingan` or `nilai_sidang` row exists ("Mahasiswa tidak dapat diubah: … sudah dinilai.").
  The lock is per field. A lecturer `kode_dosen` rename (`ON UPDATE CASCADE`) is not a reassignment and passes.

**`students`** — thesis student master.
- `npm varchar(20) unique` (digits only), `nama`, `judul_skripsi`. Used to look up a student by NPM in the defense form and importable from xlsx.
- Grading inputs: `sks_sebelum smallint null` (> 0), `bobot_sebelum numeric(7,2) null` (>= 0, and `chk_students_bobot_sebelum`: <= 4 × SKS when both are set), `tepat_waktu boolean not null default false`, `email text not null default ''` (same check as lecturers). **IPK sebelum sidang** = `round2(bobot / sks)` is derived (`ipkSebelum()`), never stored, and `—` when either is missing. Grading proceeds without an IPK.

**`settings`** — key-value configuration.
- PK `(key, prodi)`, `prodi in ('s1','s2','all')`; `type in ('int','time','text','bool','image')`, `group`, `label`, `help`, `urutan`.
- Shared keys (`all`) cover clash policy and institution identity; per-prodi keys cover prodi-specific naming and schedule rules. Full reference in §7.

**`holidays`** — faculty-wide holidays.
- `id uuid`, `tanggal date unique`, `label` (1–120 chars). One row per date; managed on the Tahun Akademik page.

**`profiles`** — user roster (1:1 with `auth.users`).
- `id → auth.users (CASCADE)`, `email`, `role in ('SUPERADMIN','SCHEDULER','VIEWER','DOSEN','EKSTERNAL')` default `VIEWER`, `prodi_access in ('s1','s2','all')` default `s1`.
- `kode_dosen varchar(30)` → `lecturers` (`ON UPDATE CASCADE`, **`ON DELETE RESTRICT`**: a DOSEN or EKSTERNAL must keep its kode, so a lecturer with an account cannot be deleted until the account goes). `profiles_kode_dosen_role_check`: `(role in ('DOSEN','EKSTERNAL')) = (kode_dosen is not null)`, so staff never have one. Partial unique index `profiles_dosen_kode_dosen_key` on `kode_dosen where role = 'DOSEN'`: one DOSEN account per lecturer (an external dosen has one EKSTERNAL account per sidang date instead).
- `berlaku_sampai date null` — the last Jakarta day an EKSTERNAL login works. `profiles_berlaku_sampai_check`: `(role = 'EKSTERNAL') = (berlaku_sampai is not null)`.
- Readable by staff, and by a DOSEN or EKSTERNAL for its own row only; **no write policy** — role changes go exclusively through service-role server actions (`/pengguna`, and for EKSTERNAL the day-account actions). Audited (`audit_profiles`), so role, kode and expiry changes are in the log.

**`aturan_penilaian`** — grading rules, one jsonb value per rule.
- PK `(prodi, kunci)`, `prodi in ('s1','s2')`, `kunci in ('aspek_bimbingan','aspek_sidang','pilihan_yudisium','tabel_nilai','predikat','sks_skripsi','tanggal_mulai_penilaian')` (`chk_aturan_penilaian_kunci`), `nilai jsonb`, `updated_at` / `updated_by` (set by trigger `set_aturan_penilaian_updated`). Only `s1` is seeded and used.
- Shapes: `aspek_bimbingan` and `aspek_sidang` `[{label, bobot, sub[]}]`; `pilihan_yudisium` `[{label, lulus}]`; `tabel_nilai` `[{min, huruf, mutu}]`; `predikat` `[{min, max, predikat, butuhTepatWaktu}]`; `sks_skripsi` an integer; `tanggal_mulai_penilaian` a `YYYY-MM-DD` string. The TS module validates the shape (§6.13); the DB only checks the key.
- Seeds (`insert … on conflict do nothing`): the four aspek of the DOSPEM I sheet (30/30/20/20), the seven aspek of the KETUA PENGUJI sheet (20/15/15/15/10/15/10), the yudisium choices (Lulus Tanpa Revisi, Lulus Dengan Revisi, Tidak Lulus), the nine-row Nilai table (A ≥ 80 … E ≥ 0), three predikat (Memuaskan 2,00–2,75, Sangat Memuaskan 2,76–3,50, Dengan Pujian 3,51–4,00 needing tepat waktu), `sks_skripsi` 6, and `tanggal_mulai_penilaian` = the **Jakarta date at migration time**.

**`nilai_bimbingan`** — one grade per (prasidang, dosen pembimbing).
- `id uuid` PK, `defense_id → defenses` (**`ON DELETE RESTRICT`**), `kode_dosen → lecturers` (`ON UPDATE CASCADE`), `peran in ('pembimbing_1','pembimbing_2')`, `unique (defense_id, peran)`.
- `aspek jsonb` (array) — the **snapshot** `[{label, bobot, skor}]` the grade was scored against; `nilai numeric(5,2)` 0–100, computed by the server from `aspek`.
- `sumber in ('dosen','manual')` default `dosen`; `submitted_at`, `submitted_by → auth.users (SET NULL)`, `created_at`, `updated_at`.
- Deleting a graded prasidang, or a Reset Jadwal covering it, fails on the restrict FK (§6.5).

**`akun_eksternal`** — one day login per (external dosen, sidang date).
- `user_id uuid` PK → `auth.users (CASCADE)`, `kode_dosen → lecturers (ON UPDATE CASCADE)`, `tanggal date`, `username text unique`, `created_at`, `unique (kode_dosen, tanggal)`. Its `profiles` row holds role `EKSTERNAL`, the kode and `berlaku_sampai`.
- Readable by staff only; **no write policy**: the service-role client creates and updates it. Audited.

**`nilai_sidang`** — one grade per (S1 sidang, examiner).
- `id uuid` PK, `defense_id → defenses` (**`ON DELETE RESTRICT`**), `kode_dosen → lecturers (ON UPDATE CASCADE)`, `peran in ('ketua','anggota_1','anggota_2')`, `unique (defense_id, peran)`.
- `aspek jsonb` — the snapshot `[{label, bobot, skor}]`; `nilai numeric(5,2)` 0–100, recomputed by trigger.
- `ada_revisi boolean`, `revisi jsonb` `[{halaman, catatan}]`; `chk_nilai_sidang_revisi`: `ada_revisi = (revisi <> '[]')`. Every revisi row needs a non-blank `catatan` (trigger `cek_nilai_sidang`).
- `sumber in ('dosen','manual')` default `dosen`; `submitted_at`, `submitted_by → auth.users (SET NULL)`, `created_at`, `updated_at`.
- Hardening, as `nilai_bimbingan`: trigger `hitung_nilai_sidang` (reuses `hitung_nilai_bimbingan()`: validates `aspek`, recomputes `nilai`, forces the timestamps on insert); `cek_nilai_sidang` also refuses an insert, or a change of aspek/revisi, once `hasil_sidang` exists unless `is_superadmin()` ("Nilai sidang sudah dikunci."). `authenticated` may update only `aspek, nilai, ada_revisi, revisi`; `service_role` may select.

**`hasil_sidang`** — the lock, one row per locked sidang.
- `defense_id uuid` PK → `defenses` (**`ON DELETE RESTRICT`**), `yudisium_label`, `yudisium_lulus boolean`, `aturan jsonb`, `locked_at`, `locked_by → auth.users (SET NULL)`.
- `email_status in ('tidak_perlu','menunggu','terkirim','gagal','sebagian')` default `tidak_perlu`, `email_detail jsonb` (one entry per address, §6.14).
- Trigger `set_hasil_sidang_locked` (security definer) validates and freezes (§6.14). `authenticated` may update only `yudisium_label, yudisium_lulus`; `service_role` may select and update only `email_status, email_detail`.
- Nilai Sidang, Nilai Akhir, IPK and predikat are never stored: they are computed from these rows, `nilai_bimbingan` and `students`, so a Super Admin correction recalculates them.

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
                      │       ├─ rooms (sidang)
                      │       └─ students (by npm, logical)
                      ├─< nilai_bimbingan >─ lecturers (graded by)
                      ├─< nilai_sidang >──── lecturers (graded by)
                      └─1 hasil_sidang (the lock)
profiles ── auth.users ──1 akun_eksternal (EKSTERNAL day login)
   └── lecturers (DOSEN, EKSTERNAL)   settings (key, prodi)
aturan_penilaian (prodi, kunci)
holidays (standalone)           audit_log (by table_name + record_id)
```

### 5.4 Authorization model (RLS)

These SQL helper functions gate the policies, all `security definer` with a fixed `search_path`:

- `is_scheduler_or_above()` — role is `SUPERADMIN` or `SCHEDULER`.
- `is_superadmin()` — role is `SUPERADMIN`.
- `can_write_prodi(prodi)` — `SUPERADMIN`, or `SCHEDULER` whose `prodi_access` is `all` or equals the row's prodi.
- `is_staff()` — role is `SUPERADMIN`, `SCHEDULER` or `VIEWER` (not `DOSEN`, not signed out).
- `my_kode_dosen()` — the caller's `kode_dosen` when its role is `DOSEN`, else null. Deliberately **not** widened to EKSTERNAL, so bimbingan stays closed to it.
- `my_kode_penguji()` — the caller's `kode_dosen` for a `DOSEN`, or an `EKSTERNAL` whose `berlaku_sampai` has not passed (Jakarta date); else null. Sidang policies use it.
- `is_eksternal_aktif()` — role `EKSTERNAL` and `(now() at time zone 'Asia/Jakarta')::date <= berlaku_sampai`.
- `my_peran_sidang(defense)` — the caller's peran (`ketua` / `anggota_1` / `anggota_2`) on an S1 sidang, else null; an active EKSTERNAL holds it only when `akun_eksternal.tanggal` equals the sidang date.
- `may_grade_bimbingan(defense, peran)` — the caller is the DOSEN holding that peran on an S1 prasidang dated today (Asia/Jakarta) or earlier.
- `may_enter_old_bimbingan(defense)` — Super Admin, on an S1 prasidang dated before `tanggal_mulai_penilaian`.
- `may_grade_sidang(defense, peran)` — the caller holds that peran, the sidang date (Jakarta) has come, the sidang is not locked, and for the Ketua both anggota rows exist.
- `may_enter_old_sidang(defense)` — Super Admin, on an S1 sidang dated before `tanggal_mulai_penilaian`.
- `may_lock_sidang(defense)` — all three `nilai_sidang` rows exist and the caller is the Ketua, or Super Admin on an old sidang.
- `kunci_sidang(...)` — an RPC, **security invoker** (RLS and triggers apply as for two inserts): inserts the Ketua's grade and the `hasil_sidang` row in one transaction and returns `email_status` (§6.14).
- `purge_expired_eksternal()` — security definer, execute revoked from `public`, `anon` and `authenticated` (only the cron job runs it): deletes the `auth.users` of EKSTERNAL accounts expired more than 30 days.

| Tables | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `schedules`, `schedule_lecturers`, `exams`, `defenses` | `is_staff()` | `can_write_prodi(prodi)` (schedule_lecturers resolves prodi through its schedule) |
| `holidays` | `is_staff()` | `is_scheduler_or_above()` |
| `courses`, `lecturers`, `rooms`, `students`, `sessions`, `academic_years`, `settings` | `is_staff()` | `is_superadmin()` |
| `profiles` | `is_staff()`, or the caller's own row | — (service-role actions only) |
| `audit_log` | `is_staff()` | — (trigger only) |
| `aturan_penilaian` | `is_staff()`, or any caller with `my_kode_penguji()` (DOSEN, active EKSTERNAL) | `is_superadmin()` |
| `akun_eksternal` | `is_staff()` | — (service-role only) |
| `nilai_bimbingan` | `is_staff()`, or a DOSEN's own rows (`kode_dosen = my_kode_dosen()`) | INSERT: a DOSEN with `sumber = 'dosen'`, passing `may_grade_bimbingan`, own `kode_dosen`, `submitted_by = auth.uid()`; or Super Admin with `sumber = 'manual'` passing `may_enter_old_bimbingan`. UPDATE: `is_superadmin()`. **No DELETE policy**: nobody deletes a grade |
| `nilai_sidang` | `is_staff()`, or `my_peran_sidang(defense_id)` is the row's peran or `ketua` (the Ketua reads all three) | INSERT: `sumber = 'dosen'` passing `may_grade_sidang`, own `kode_dosen` (`my_kode_penguji()`), `submitted_by = auth.uid()`; or Super Admin with `sumber = 'manual'` passing `may_enter_old_sidang`. UPDATE: `is_superadmin()`. **No DELETE policy** |
| `hasil_sidang` | `is_staff()`, or any examiner of that sidang (`my_peran_sidang` not null) | INSERT: `may_lock_sidang` and `locked_by = auth.uid()`. UPDATE: `is_superadmin()`. **No DELETE policy**: nobody unlocks |

**DOSEN and EKSTERNAL isolation.** A DOSEN session holds a real Supabase JWT and the anon key is public, so every staff read policy requires `is_staff()` (written `(select is_staff())`, evaluated once per query). A DOSEN querying Supabase directly reads zero rows of every data table, `audit_log` and `settings`; it reads only its own `profiles` row, its own grade rows and `aturan_penilaian`. An active EKSTERNAL is the same with less: `my_kode_dosen()` is null for it, so it reads no bimbingan row at all, and its sidang rows are only those of its account's day. The grading pages therefore load defense and student data with the service-role client, after the role check and the access rule of §6.13 / §6.14. `check:db` asserts that each hidden table holds rows yet reads empty for a DOSEN and for an EKSTERNAL.

UI mirrors the DB: `canWrite(role)` shows schedule controls, `canManage(role)` (Super Admin) shows master-data/settings/user controls. The UI check is cosmetic; RLS is the enforcement.

### 5.5 Audit trail

- `audit_row()` — a single `security definer` trigger function attached to every data table (`schedules`, `schedule_lecturers`, `exams`, `defenses`, `courses`, `lecturers`, `rooms`, `students`, `sessions`, `settings`, `academic_years`, `holidays`, `aturan_penilaian`, `nilai_bimbingan`, `nilai_sidang`, `hasil_sidang`, `profiles`, `akun_eksternal`, …). It records actor (from `auth.uid()`), action, table, record id, and before/after JSON.
- The record id is the first of `id`, `kode_mk`, `kode_dosen`, `key`, `kunci` present (`kunci` so a rule edit has a history). Grade and rule writes run on the signed-in user's own session, so the actor is the real dosen or Super Admin, not the service role. `TABLE_LABEL` does not name `aturan_penilaian` / `nilai_bimbingan` / `nilai_sidang` / `hasil_sidang` / `akun_eksternal` yet, so Log Aktivitas shows their raw table names. The service-role writes of the day-account actions run with no `auth.uid()`, so `perpanjangAction` and `buatPasswordBaruAction` insert their own `audit_log` row with the acting Super Admin/Penjadwal (never a password).
- `lecturers.jadwal_token` is stripped from both sides before writing — a token rotation is never visible in the log.
- Auth events (login/logout) are appended via the service-role client.
- Surfaced in two places:
  1. `/log-aktivitas` — filterable browser (table, action, actor, free-text search; 50 rows/page).
  2. `/log-aktivitas/riwayat?tabel=…&id=…` — per-record timeline with human values (course/lecturer/room names resolved by `audit-history.ts`), changed-field chips, and an identity strip.
- Retention: nightly purge (`pg_cron`, 03:00) removes entries older than 1 month.

### 5.6 Migrations and schema evolution

- `supabase/migrations/YYYYMMDDNNNNNN_description.sql`, applied in filename order.
- Two application paths:
  - Supabase CLI: `npx supabase link … && npx supabase db push`.
  - SQL editor: paste each file (the project's de-facto production path for incremental changes) — **or** `supabase/all_in_one_setup.sql` for a fresh database. When adding a migration, append it to the all-in-one file too.
- A migration that needs an extension only Supabase has (`20261116000002_eksternal_cleanup.sql`, like the audit-log retention one, needs `pg_cron`) is skipped by `check:db` and must be applied by hand on the project.
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

- **Prasidang**: Zoom, in numbered breakout rooms (`kelompok`); examiner roles are Pembimbing Pendamping and Dosen Pembahas; no Anggota Penguji I. On S1 these two dosen grade the student online (§6.13).
- **Sidang**: physical room + Penguji Eksternal (Anggota Penguji I), Ketua Sidang, Anggota Penguji II (Pembimbing). On S1 these three grade the student online (§6.14); saving an S1 sidang whose Anggota Penguji I is a `lecturers.eksternal` dosen also makes that day's login (§6.14).
- The form looks students up from `students` by NPM (free text still accepted), and penguji from the dosen master (`penguji_eksternal_kode`); legacy typed names remain in `penguji_eksternal`.
- **Dosen eksternal** (`lecturers.eksternal`) may only be Anggota Penguji I, in both jenis and both prodi. The form omits them from the Pembimbing Pendamping, Dosen Pembahas, Ketua Sidang and Anggota Penguji II selects, and `saveDefenseAction` refuses them with "Dosen eksternal hanya dapat menjadi Anggota Penguji I." Only a dosen newly put in a role is checked: a row saved earlier keeps its dosen (still listed in its own select) and the board flags it with a banner.
- **Graded prasidang**: once a pembimbing has graded, that dosen select is disabled with "Sudah dinilai" (the DB trigger `lock_graded_defense` enforces it; §5.2). Deleting the prasidang is refused by the restrict FK with "Prasidang ini sudah dinilai, sehingga tidak bisa dihapus." The Reset Jadwal modal counts the graded prasidang of the year and locks that prodi's Sidang cell ("N prasidang sudah dinilai: tidak bisa direset") instead of letting the transaction fail.
- **Graded sidang**: once an examiner has graded, that examiner's select is disabled with "Sudah dinilai", and once any grade exists the whole date/time block is disabled (the DB locks the date, not the hour, but the form doesn't invite a refused save). The restrict FKs of `nilai_sidang` and `hasil_sidang` refuse a delete ("Sidang ini sudah dinilai, sehingga tidak bisa dihapus.", matched by constraint name), and the Reset Jadwal count includes sidang with a grade.
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
- The page (no login) lists, upcoming first: the lecturer's kuliah (from `schedule_lecturers`, including team-taught classes), exams (as pengawas or pengampu; a `GABUNGAN` exam matches by MK), and defenses (as pembimbing, penguji, or anggota penguji I). Each sidang row shows peran, program, place (zoom/passcode or room) and the materi link button. An S1 prasidang row where the dosen is pembimbing or pembahas also shows **Beri Nilai** → `/nilai-bimbingan/<defenseId>`, next to the materi button, and every S1 sidang row (all three examiner roles) shows it → `/nilai-sidang/<defenseId>` (`linkNilai()`, one source for the page and the calendar). The button is only a link: the target needs a DOSEN or EKSTERNAL login, so the page stays public and read-only.
- Confidentiality: `next.config.ts` sets `X-Robots-Tag: noindex, nofollow` and `Referrer-Policy: no-referrer` on `/jadwal-dosen/*`; the page metadata is also `robots: { index: false, follow: false }`.
- Reads use the service-role client (grants on the underlying tables were added by migration `20261008000003`); the query is scoped strictly to the token's `kode_dosen`.

### 6.8 ICS calendar feed

`/jadwal-dosen/[token]/kalender.ics` (covered by `check:ics`, `check:jadwal-dosen`):

- RFC 5545 text built by `src/lib/ics.ts`: CRLF lines, 75-octet folding that never splits a UTF-8 character, proper escaping; wall-clock times in `Asia/Jakarta` (UTC+7, no DST).
- Kuliah meetings are expanded to real dates with `kuliahDates()`; skipped occurrences (exam weeks, holidays) are listed as `EXDATE`s rather than dropped silently, so subscribed clients remove them.
- Recurrence is weekly or biweekly (`repeat.weeks = 1|2`) until `selesai_kuliah`.
- Events: `Kuliah · <MK> (<kelas>) · <S1|S2>` with place as `LOCATION`, program/parity as `DESCRIPTION`; exams (`<UTS|UAS> <peran> · <MK> (<kelas>) · <S1|S2>`; take-home = all-day); defenses with the materi link in `DESCRIPTION`, followed on an S1 prasidang (pembimbing or pembahas) by `Penilaian: <origin>/nilai-bimbingan/<defenseId>`, and on an S1 sidang (any of the three examiners) by `Penilaian: <origin>/nilai-sidang/<defenseId>`, on its own line. The origin comes from the request URL.
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
- Grading fields: Mahasiswa `email`, `sks_sebelum`, `bobot_sebelum`, `tepat_waktu` and Dosen `Email`, `Eksternal` (`ya`/`tidak`, any case; blank = tidak; anything else rejects the row). `sksBobot()` mirrors the DB checks (SKS a positive integer, 0 <= bobot <= 4 × SKS); both accept a comma decimal.
- **Old files keep newer data**: a column absent from the uploaded file neither changes nor flags the stored value (`has()` / `same()` in `tables.ts`), so a pre-feature xlsx cannot wipe emails or SKS. A column that is present but blank does write the blank.

### 6.11 Print and document generation

- xlsx is built server-side with `exceljs` (`lib/xlsx.ts` helpers: borders, wrapped-row heights, merged headers, signature images); the PDF route converts the xlsx via Aspose when configured, otherwise offers the Excel download.
- The Word **Surat Penugasan** is generated with `docx` (per-dosen recap; page-fit assertions in `check:surat`).
- Documents are driven by settings: header lines (`header_baris` with `{semester}`, `{angkatan}`, `{term}`, `{tahun}` placeholders via `substituteTemplate`), footer notes (`keterangan_cetak`), signatories (nama/jabatan/gambar tanda tangan; dekan and wakil dekan roles), paper size and orientation.
- Cetak PDF/XLSX routes exist for kuliah, ujian and sidang; rekap routes for kuliah (docx) and ujian (xlsx).

### 6.12 Audit surfacing

- A change is attributed to the acting user (or, for public/token-driven changes, system actions), labelled through `TABLE_LABEL`, and rendered with human values (course names, lecturer display names, room names) everywhere it appears.
- The Riwayat page answers "what happened to this record", and the Log Aktivitas page (linked from the hub's "Lainnya" line) answers "what happened lately".

### 6.13 Nilai Bimbingan (S1 prasidang grading)

Pure logic in `src/lib/penilaian/` is covered by `check:nilai-bimbingan`; the proxy gate by `check:proxy`; role resolution by `check:roles`; the policies, lock and seeds by `check:db`.

**Who grades what.** Only an S1 prasidang (`bisaDinilai()`: `prodi = 's1'` and `jenis = 'prasidang'`). Dosen Pembimbing I is `defenses.pembimbing_kode` (peran `pembimbing_1`), Dosen Pembimbing II is `defenses.penguji_kode` (peran `pembimbing_2`). One grade per (prasidang, peran).

**Access rules.** `aksesDosen()` decides, in this order, for a signed-in DOSEN with a `kode_dosen`:
1. Not an S1 prasidang, a malformed id, or the dosen holds no peran on it → `tidak-ada`: a 404 that gives no hint the record exists.
2. The dosen already submitted → `terkirim`: the read-only view. This wins over the date, so a grade stays visible if the prasidang moves later.
3. Today (Asia/Jakarta, `todayJakarta()`) is before `defenses.tanggal` → `belum-dibuka`: "Penilaian dibuka pada <tanggal>".
4. Otherwise `isi`: the form.

A dosen never sees the other dosen's grade. Signed out → `/masuk?redirectTo=…`. `submitNilaiAction` re-runs these rules, and RLS (`may_grade_bimbingan`) checks them a third time.

**Math** (`nilai.ts`). Nilai dosen = Σ (skor × bobot / 100) over the snapshot rows, `round2`. `round2` is half-up to 2 decimals; a `toPrecision(12)` step absorbs binary noise, so 75,995 becomes 76,00. Nilai Bimbingan = `round2((Dospem I + Dospem II) / 2)`, only once both grades exist. Huruf = the Tabel Nilai row with the highest `min` <= the rounded score (the lowest row if below all). Scores accept a comma or dot decimal, 0–100, at most 2 decimals (`parseAngka`). Example with the defaults: 86, 78, 78, 76 → 25,80 + 23,40 + 15,60 + 15,20 = 80,00 → A; (80,00 + 77,00) / 2 = 78,50 → A-.

**Rules** (`aturan.ts`, table `aturan_penilaian`). Super Admin edits seven rules on Pengaturan Penilaian S1, each card saved on its own: aspek bimbingan, aspek sidang, pilihan yudisium, Tabel Nilai, predikat yudisium, SKS skripsi, tanggal mulai penilaian. (Aspek sidang validates like aspek bimbingan; pilihan yudisium is in §6.14.) The editor shows the `validate*` message inline and `saveAturanAction` repeats shape check and validation before an upsert on the session client (so the audit log names the actor).
- Aspek: at least one row, non-blank label, bobot > 0, Σ bobot = 100.
- Tabel Nilai: one row with `min` 0, `min` 0–100 and distinct, huruf non-blank and distinct, mutu 0–4.
- Predikat: at least one row, IPK 0–4, min <= max, no overlap (compared in whole hundredths, so 2,75 vs 2,76 is fine).
- SKS skripsi: a positive integer. Tanggal: a real `YYYY-MM-DD` date.
- `loadAturan(db, 's1')` parses each key and falls back to `DEFAULT_ATURAN` for a key that is missing or invalid, so a bad row never blocks grading (`tanggalMulai` falls back to today's Jakarta date, as the seed does). It **throws on a DB error**: falling back then would freeze a default aspek list into an immutable grade.
- `predikat` and `sks_skripsi` are read by Nilai Akhir (§6.14), through the copy a locked sidang froze.

**Snapshot rule.** A grade stores the `[{label, bobot, skor}]` it was scored against plus the computed `nilai`; editing the rules later never changes a submitted grade. The Tabel Nilai is applied live to show letters. The server recomputes `nilai` from `aspek` and shape-checks the client's scores (`snapshotDariSkor`).
- **Stale form refusal.** The page binds the displayed `[label, bobot]` list into the submit action (`AspekTampil`). If `aspekSama()` finds it differs from the current list at submit, the dosen submit and the Super Admin old-grade entry answer "Daftar aspek penilaian berubah. Muat ulang halaman lalu isi lagi." and write nothing. A Super Admin edit re-scores against the stored row's own snapshot, so it needs no such check.

**Submit and lock.** A dosen inserts through the session client (`sumber = 'dosen'`, `submitted_by = auth.uid()`), after a confirm dialog ("Setelah dikirim, nilai tidak bisa diubah."). There is no update or delete policy for a DOSEN, so a submitted grade is final for them. A double submit (two tabs) hits `unique (defense_id, peran)`, answers "Nilai sudah dikirim." and the form refreshes into the read-only view.

**Super Admin.**
- Edits a submitted grade (`editNilaiAction`): only `aspek` and `nilai` change, re-scored on the stored snapshot; the change is in Log Aktivitas.
- Cannot create a grade for a dosen on a prasidang on or after `tanggal_mulai_penilaian`, cannot unlock a grade for a redo, and cannot delete (no policy).
- **Old-grade entry**: on a prasidang dated before `tanggal_mulai_penilaian` (`bolehInputLama()`, `may_enter_old_bimbingan`), a missing grade shows "Masukkan nilai lama": the current aspek list, the same confirm step, inserted with `sumber = 'manual'` and `submitted_by` = the Super Admin. `kode_dosen` is taken from the defense for that peran by the action (the DB does not tie `kode_dosen` to the peran on a manual row). The recap marks such grades "(input manual)".
- The start date is seeded with the Jakarta date at migration time, so every earlier prasidang counts as old. Pengaturan can move it; "Kembalikan ke bawaan" resets it to today.
- Penjadwal and Pemantau see the grading page and the recap read-only.

**Recap and export.** `/[prodi]/sidang/nilai-bimbingan` (S1 only) lists one row per S1 prasidang of the chosen tahun akademik (`?ay=`, else the active year, else the newest), by tanggal then nama (pure `buildRekapBimbingan`): NPM, nama, judul, IPK, Dospem I name/nilai/huruf, Dospem II name/nilai/huruf, Nilai Bimbingan and huruf, with "belum dinilai" where a grade is missing. `GET /api/nilai-bimbingan?year=` returns the same columns as xlsx (numbers stay numbers, `0.00`; a missing grade is a blank cell). Both read on the session client (RLS) and throw on a DB error. HeaderNav adds a "Nilai Bimbingan" tab to the S1 sidang section and a "Penilaian" tab to the S1 Data Master section for Super Admin.

**Dosen accounts.** On Pengguna, Super Admin sets a role of Dosen and picks a lecturer: only a non-`eksternal` lecturer with no DOSEN account yet. `resolveAccess()` validates before anything is written, and a single profile update sets role, `kode_dosen` and `prodi_access = 's1'` (the DB check ties role to `kode_dosen`). A failed profile write after `createUser` deletes the new auth user, so no login is left without its profile. Moving an account to a staff role clears `kode_dosen`. **Atur ulang kata sandi** (Super Admin, any account) sets a `generatePassword()` value through the admin API and shows it once in a modal; it is neither stored nor logged. It exists because Supabase's built-in mailer may not reach dosen addresses.

### 6.14 Nilai Sidang and Nilai Akhir (S1 sidang grading)

Pure logic in `src/lib/penilaian/` and the mailer is covered by `check:nilai-sidang`; the proxy gate by `check:proxy`; role resolution by `check:roles`; the policies, triggers, lock and `kunci_sidang` by `check:db`. It builds on §6.13 and reuses its rules loader, snapshot rule, stale-form refusal and hardening pattern.

**Who grades what.** Only an S1 sidang (`bisaDinilaiSidang()`: `prodi = 's1'` and `jenis = 'sidang'`). `peranPenguji()` maps the caller's kode: Ketua Sidang = `defenses.penguji_kode` (peran `ketua`), Anggota Penguji I = `penguji_eksternal_kode` (`anggota_1`), Anggota Penguji II = `pembimbing_kode` (`anggota_2`). One grade per (sidang, peran). A legacy free-text Anggota Penguji I (`penguji_eksternal`, no kode) cannot grade: the page and recap say "Anggota Penguji I belum dipilih dari data dosen" and the lock stays impossible until admin picks a dosen.

**Access rules.** `aksesSidang()` decides, in this order, for an examiner (a DOSEN, or an active EKSTERNAL whose account day is passed as `akunTanggal`):
1. Not an S1 sidang, a malformed id, no peran on it, or (EKSTERNAL) a sidang whose date is not the account's day → `tidak-ada`: a 404 that gives no hint the record exists.
2. `hasil_sidang` exists → `terkunci`: read-only for everyone. This and the next step win over the date, so a rescheduled graded sidang stays visible.
3. The examiner's own grade exists → `terkirim`.
4. Today (Asia/Jakarta) is before `defenses.tanggal` → `belum-dibuka`: "Penilaian dibuka pada <tanggal>".
5. An anggota → `isi`: the form. The Ketua → `menunggu-anggota` (naming who is missing) until both anggota have submitted, then `kunci`.

Penilaian Saya maps these to Belum dibuka / Belum dinilai / Menunggu anggota / Terkirim / Terkunci. Actions re-run `aksesSidang()` (through `aksesAksi`, which also re-reads the user, so an expired EKSTERNAL is refused), and RLS (`may_grade_sidang`, `may_lock_sidang`) checks a third time.

**Flow.**
1. **Anggota I and II** each submit once from the sidang date (`submitNilaiSidangAction`): session-client insert, `sumber = 'dosen'`, `submitted_by = auth.uid()`, after the confirm "Setelah dikirim, nilai tidak bisa diubah.". A double submit hits `unique (defense_id, peran)` and answers "Nilai sudah dikirim.".
2. **The Ketua** sees both anggota's scores and revisi, fills their own form, picks the yudisium and presses "Kirim nilai dan kunci" (confirm: "Setelah dikunci, nilai sidang tidak bisa diubah."). `kunciSidangAction` calls the RPC `kunci_sidang`, which inserts the Ketua's grade **and** the `hasil_sidang` row in one transaction. A failed lock therefore never leaves a Ketua grade behind (which would block the sidang for good: the Ketua grades once, and only the Ketua locks). The yudisium comes from the current `pilihan_yudisium` list, and the DB checks the pair again.
3. **After the lock commits** and only when the RPC returned `email_status = 'menunggu'`, the action calls `kirimRevisi` (below) and returns its outcome. Any problem in the send leaves the lock standing; a DB error while recording the outcome leaves `email_status` at `menunggu`.

**What the DB does at lock** (trigger `set_hasil_sidang_locked`, security definer, so the client cannot set these):
- Checks the (`yudisium_label`, `yudisium_lulus`) pair is one of `pilihan_yudisium` on insert and whenever the pair changes ("Yudisium tidak ada dalam pilihan yudisium."); an unrelated update, such as the email outcome, never re-checks.
- **Freezes the rules**: `aturan` = `{tabelNilai, predikat, sksSkripsi}` copied from `aturan_penilaian` (the keys match the TS `AturanBeku`). Every later result for that sidang, including a Nilai Akhir that completes when bimbingan does, uses this copy. Editing the rules afterwards changes no locked sidang; examiner grades already carry their own aspek snapshot.
- Sets `locked_at = now()` and `email_status`: `tidak_perlu` when the sidang is old (`tanggal < tanggal_mulai_penilaian`) or no examiner ticked "Ada revisi", otherwise `menunggu`.

**Math** (`nilai.ts`, all `round2`, half-up). Nilai examiner = Σ (skor × bobot / 100) over its snapshot (as §6.13). **Nilai Sidang** = `round2` of the average of the three, only once all three exist. **Nilai Bimbingan** is looked up by NPM: the latest S1 prasidang of that NPM (any tahun akademik; by tanggal, then id); while that one is incomplete it is null (an older prasidang never fills in). `hasilAkhir()` returns one status:
- `menunggu-ketua`: no `hasil_sidang` yet.
- `tidak-lulus`: the yudisium is not a `lulus` choice. The scores stay visible; Nilai Akhir, IPK and predikat stay empty.
- `data-kurang`: fewer than three grades, SKS sebelum / bobot sebelum not filled ("SKS/Bobot belum diisi"), or the frozen copy is unreadable (the recap then says so rather than computing from guesses).
- `menunggu-bimbingan`: Nilai Bimbingan is not complete.
- `lengkap`: **Nilai Akhir** = `round2((Nilai Bimbingan + Nilai Sidang) / 2)`; huruf and bobot mutu from the frozen Tabel Nilai; **IPK setelah** = `round2((bobot_sebelum + sksSkripsi × mutu) / (sks_sebelum + sksSkripsi))`; **predikat** = the frozen row whose [min, max] holds the IPK, compared in whole hundredths. A row marked `butuhTepatWaktu` steps down to the next lower row that does not need it when `students.tepat_waktu` is false; an IPK below every row, or nothing left below, gives no predikat.

Example (ABDURRAHMAN): bimbingan 78,50 and sidang 76,50 → 77,50 → A- → 3,67; (404,57 + 6 × 3,67) / (139 + 6) = 2,94 → Sangat Memuaskan.

**Rules.** Two more `aturan_penilaian` kunci, edited on Pengaturan Penilaian: `aspek_sidang` (same shape and validation as `aspek_bimbingan`; default the seven aspek of the KETUA PENGUJI sheet, 20/15/15/15/10/15/10) and `pilihan_yudisium` (`[{label, lulus}]`; `validatePilihanYudisium`: no blank label, at least one lulus and one not, distinct labels; default Lulus Tanpa Revisi, Lulus Dengan Revisi, Tidak Lulus). `loadAturan` falls back per key and throws on a DB error, as in §6.13. Every sidang action takes the displayed `[label, bobot]` list and refuses a stale form with "Daftar aspek penilaian berubah. Muat ulang halaman lalu isi lagi." (`aspekSama`); the Super Admin edit re-scores on the stored snapshot and needs no such check.

**Revisi.** Each examiner may tick "Ada revisi" and fill rows (`halaman` optional text, up to 50 characters; `catatan` required, up to 2000; up to 100 rows). `cekRevisi()` drops the rows when the box is off; with it on, at least one row is required. The DB repeats the shape check (`cek_nilai_sidang`, `chk_nilai_sidang_revisi`). Ticked revisi does not force "Lulus Dengan Revisi": the yudisium is the Ketua's call.

**Super Admin.**
- Edits a submitted grade (`editNilaiSidangAction`: aspek and nilai re-scored on the stored snapshot, revisi replaced) or the yudisium of a locked sidang (`editYudisiumAction`). Both are audited with the actor, and **neither re-sends the email**.
- Never unlocks, never deletes, never creates a grade on a sidang dated on or after `tanggal_mulai_penilaian`.
- **Old sidang** (`bolehInputLamaSidang()`, `may_enter_old_sidang`): enters a missing grade (`inputNilaiSidangLamaAction`, `sumber = 'manual'`, `kode_dosen` taken from the defense for that peran) and, once all three exist, locks it on the Ketua's behalf (`kunciSidangLamaAction`: a plain `hasil_sidang` insert of four columns; the DB sets the rest and `email_status = 'tidak_perlu'`). The grading page marks such a grade "(input manual)"; the recap does not.
- Penjadwal and Pemantau read the page and recap only.

**Revisi email** (`mailer.ts`, `email-revisi.ts`; covered by `check:nilai-sidang`).
- **Transport:** nodemailer over `smtp.gmail.com:465` (TLS). Env `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`; never stored in the repo or the database; credentials are never logged. Setup is in §9.7. If any of the three is missing, every address is recorded `gagal` with "SMTP belum dikonfigurasi".
- **One message** per student, to the student (`students.email` by NPM) and the three examiners (`lecturers.email`), duplicates removed case-insensitively. A blank or invalid address is skipped and listed in `email_detail` as `dilewati` with the reason, so the recap shows who did not get it.
- **Content:** subject `Revisi Sidang Skripsi — <nama> (<npm>)`; plain text and simple HTML with nama, NPM, judul, tanggal sidang, yudisium, then for each examiner who has revisi their role and name with a Halaman / Catatan revisi table. **Grades are never included.** No revisi anywhere → no email, status `tidak_perlu`.
- **Status:** `kirimRevisi()` sends only from `menunggu` (first send) or `gagal` / `sebagian` (retry); any other status is returned untouched, so a double click cannot re-send a finished mail. All addresses accepted → `terkirim`; none → `gagal`; otherwise `sebagian`. The outcome is written with the admin client to `email_status` / `email_detail`. The send never runs inside a DB transaction.
- **Timeouts:** 10 s. Connection, greeting and socket phases each carry the cap, and the send is raced against it, so a send given up on cannot still deliver afterwards; a timeout records `gagal`.
- **Retry:** Super Admin only, "Kirim ulang email" on the recap (`kirimUlangEmailAction`). `bolehKirimUlang()` allows `gagal` and `sebagian` at once, and `menunggu` only more than 2 minutes after `locked_at` (stuck, not in flight). It retries a failed send; it is not a re-send after a correction. There is no lock against two concurrent retries.

**Temporary day logins (EKSTERNAL).**
- **Creation:** `saveDefenseAction` calls `akunPenguji` after a successful save of an S1 sidang whose `penguji_eksternal_kode` is a `lecturers.eksternal` dosen; `ensureAkunEksternal()` (service role) makes the account once per (dosen, date), shared by every sidang that dosen examines that day. The username is `eks-<kode, lowercase alphanumeric>-<ddmmyy>`, the auth email `<username>@penguji.local`, the password 10 random characters from the unambiguous alphabet (no `0 O 1 l I`). A new account's password comes back once in the save result and is shown in the dialog "Akun penguji eksternal dibuat — catat dan serahkan"; it is stored nowhere. Admin hands it over in person.
- **Never undoes the save:** a failure comes back as `akunError` ("Jadwal tersimpan, tetapi akun penguji eksternal belum dibuat: …"); saving the sidang again retries. An existing account is only ever extended up to `tanggal + 1`, never shortened. A sidang whose `tanggal + 1` is already past makes no account. A half-made login is deleted again. Two saves at once for the same dosen and day collide on the username or the `akun_eksternal` row: the loser reports the account as existing, or, if the winner has not written its row yet, reports a leftover login.
- **Login:** the login form takes a bare username; `signInAction` appends `@penguji.local` (`emailLogin`).
- **Expiry:** valid while `(now() at time zone 'Asia/Jakarta')::date <= berlaku_sampai`, where `berlaku_sampai = tanggal + 1`. Enforced in SQL by `is_eksternal_aktif()` and `my_kode_penguji()` (so RLS stops working for an expired account) and in the app by `eksternalAktif()`: `signInAction` refuses with "Akun ini sudah tidak berlaku.", `loadCurrentUser` treats it as signed out, and the proxy signs it out (§4.3).
- **Akun Penguji Eksternal page** (`/[prodi]/sidang/akun-eksternal`): a card per account with dosen, date, username, that day's students, expiry and status (Aktif / Kedaluwarsa). **Buat password baru** (`buatPasswordBaruAction`; Super Admin and Penjadwal with S1 access) sets a new password through the admin API, shows it once and writes an `audit_log` row without it. **Perpanjang** (`perpanjangAction`; **Super Admin only**) adds 1–7 days to `berlaku_sampai` and writes an `audit_log` row with the acting user, the old and new date and `perpanjang_hari`. Both actions touch only an account that exists in `akun_eksternal` with role `EKSTERNAL`.
- **Pengguna refuses EKSTERNAL**: it is not offered in the role pickers, `readRole()` rejects it, and `updateUserRoleAction` refuses to change an EKSTERNAL account ("Akun penguji eksternal dikelola dari halaman Akun Penguji Eksternal."), because the DB ties the role to `berlaku_sampai`.
- **Cleanup:** the nightly `pg_cron` job `purge_expired_eksternal` (20:30 UTC = 03:30 WIB, migration `20261116000002`) calls `purge_expired_eksternal()`, which deletes the `auth.users` of EKSTERNAL accounts expired more than 30 days. `profiles` and `akun_eksternal` cascade; grades keep `submitted_by = null`.

**Recap and export.** `/[prodi]/sidang/nilai-akhir` (S1 only) lists one row per S1 sidang of the chosen tahun akademik (`?ay=`, else the active year, else the newest), by tanggal then nama (pure `buildRekapAkhir`): No, NPM, Nama, Judul, Nilai Bimbingan, the three examiners (name and nilai), Nilai Sidang and huruf, Yudisium, Nilai Akhir with huruf and bobot mutu, IPK sebelum, IPK setelah, predikat and email status. A cell that is not final says why ("Menunggu Ketua Penguji mengunci hasil sidang", "Menunggu Nilai Bimbingan lengkap", "SKS/Bobot belum diisi", …). `GET /api/nilai-akhir?year=` returns the same columns (without No) as xlsx: numbers stay numbers (`0.00`), a missing value is a blank cell, and a non-final sidang puts its reason in the Nilai Akhir cell. Both read on the session client (RLS) and throw on a DB error. HeaderNav adds "Nilai Akhir" and, for Super Admin and Penjadwal with S1 access, "Akun Penguji Eksternal" tabs to the S1 sidang section.

---

## 7. Settings Reference

Settings live in the `settings` table and are edited per prodi in **Pengaturan** (shared keys appear once as the `all` tier). Groups as surfaced in the UI:

| Group | Purpose | Representative keys |
|---|---|---|
| `waktu` (Waktu & Sesi) | Session grid generation | `menit_per_sks`, `jeda_menit`, `jam_mulai_reguler`, `jam_mulai_regsus`, `jam_istirahat_mulai`, `jam_istirahat_selesai`, `hari_aktif` |
| `kelas` | Class-size advice | `kelas_maksimal`, `maks_mahasiswa_per_kelas`, `min_mahasiswa_pilihan` |
| `bentrok` | Clash policies & load | `bentrok_dosen`, `bentrok_kelas`, `bentrok_ruangan` (`blok`/`peringatan`/`abaikan`), `izinkan_override`, `bentrok_beban`, `maks_sks_dosen` |
| `cetak` | Institution identity & kuliah sheet layout | `nama_universitas`, `nama_fakultas`, `kota`, `nama_prodi`, `header_baris`, `keterangan_cetak`, `ukuran_kertas`, `orientasi`, `zoom_id`, `zoom_passcode` |
| `tanda_tangan` | Signers & signature image | `nama_wakil_dekan`, `jabatan_wakil_dekan`, `nama_penandatangan`, `jabatan_penandatangan`, `gambar_tanda_tangan` |
| `surat` | Surat Penugasan document | `nomor_surat`, `perihal_surat`, `lampiran_surat`, `catatan_perkuliahan`, `nama_dekan`, `jabatan_dekan`, `gambar_tanda_tangan_dekan` |
| `ujian` | Exam slots, invigilation, print note & paper | `sesi_ujian_reguler`, `sesi_ujian_regsus`, `pengawas_cadangan`, `ujian_header_baris`, `catatan_ujian`, `ukuran_kertas_ujian`, `orientasi_ujian` |
| `sidang` | Defense slots & Zoom | `sesi_prasidang`, `sesi_sidang`, `prasidang_zoom_id`, `prasidang_zoom_passcode`, `prasidang_header_baris`, `sidang_header_baris` |

Notes:

- Term boundaries (`mulai_kuliah`, `selesai_kuliah`) are **not** settings — they live on `academic_years`.
- Grading rules (aspek, Tabel Nilai, predikat, SKS skripsi, tanggal mulai penilaian) are **not** settings either: they live in `aturan_penilaian` (§5.2) and are edited on Pengaturan Penilaian (§6.13).
- The canonical, always-current list is the Pengaturan page itself; seeds live in the migrations (`20260921000003_seed_initial_data.sql` onward). Some keys (`gambar_tanda_tangan*`) are `type = 'image'` and hold data URIs/URLs.

---

## 8. Security

### 8.1 Authentication

- Supabase Auth, email + password. **There is no sign-up page**; accounts are created by a Super Admin on `/pengguna` (service-role admin client) or in the Supabase dashboard. New accounts default to `VIEWER` / `prodi_access = 's1'`; the first account must be promoted to `SUPERADMIN` with a one-off SQL statement (see README).
- Session handling: cookie-based via `@supabase/ssr`; refreshed in `proxy.ts` using `getClaims()` (local JWT verification, no Auth round-trip). The gate fails closed on errors.
- `/masuk`, `/auth/callback`, `/jadwal-dosen/*` and static assets are the only unauthenticated surfaces.
- `/atur-kata-sandi` lets a user change their own password (not a Penguji Eksternal). A Super Admin can also reset any account's password (a generated 12-character value, shown once).
- A `DOSEN` account is created on `/pengguna` like a staff account, linked to one lecturer. After login every page except its own sends it to `/penilaian`.
- An `EKSTERNAL` account is never created on `/pengguna`: it is made by the system when a sidang with an external Anggota Penguji I is saved (§6.14), signs in with a bare username, and works only through `berlaku_sampai` (Jakarta date). After that the login refuses ("Akun ini sudah tidak berlaku."), the session is signed out by the proxy and `loadCurrentUser`, and RLS stops answering (`my_kode_penguji()` is null).

### 8.2 Authorization

Three layers, with the DB as the source of truth:

1. **Route gate** — proxy (session, plus the DOSEN and EKSTERNAL allowlists of §4.3) + `[prodi]/layout.tsx` (404 unknown prodi, redirect when `prodi_access` excludes it). `AppHeader` repeats the examiner check as a page-level backstop (a DOSEN or EKSTERNAL on any page outside its list is redirected to `/penilaian`; it also hides "Ganti kata sandi" for an EKSTERNAL), and `GET /api/nilai-bimbingan` and `GET /api/nilai-akhir` refuse an examiner themselves.
2. **RLS policies** — per-table, per-action (see §5.4). Even a hand-crafted API call cannot write outside the caller's role/prodi, and a DOSEN's or EKSTERNAL's own JWT reads no staff data (`is_staff()`); an EKSTERNAL additionally reads no bimbingan row and only its account day's sidang.
3. **UI affordances** — `canWrite` / `canManage` hide controls the role cannot use.

Page-level guards on top: master-data pages and actions call `managerOnly()` / `manageableProdi()` (`prodi-server.ts`), which re-check the role server-side.

### 8.3 Public token surface

- Scope: the token resolves to exactly one lecturer; the page and feed read only rows where that lecturer appears. No write path exists through the token.
- Transport & discovery: tokens travel in the URL; configured headers (`noindex`, `no-referrer`) keep them out of search engines and prevent leaking through outbound links.
- Rotation: re-running `set_jadwal_token(..., p_reset := true)` invalidates the old URL. Tokens are excluded from the audit log, from exports (`jadwal_token` dropped), and from printed output.
- The `Beri Nilai` button and the ICS `Penilaian:` line are plain URLs to `/nilai-bimbingan/<defenseId>` or `/nilai-sidang/<defenseId>`. They grant nothing: the page needs a signed-in DOSEN (or, for a sidang, an active EKSTERNAL of that day) who holds a peran on that defense (anyone else gets a 404 or a login redirect), so a forwarded link cannot show or submit a grade.
- The public feed endpoints are excluded from the proxy matcher on purpose; their safety derives from the service-role query scoping above.

### 8.4 Input validation and data integrity

- Database constraints are the last line: CHECKs on enums/parities/roles/time ranges/place rules, UNIQUEs on natural keys and per-scope uniqueness, FK actions chosen per relation (§5.2).
- Server actions validate form input before hitting the DB and return `{ error }` for inline display; `humanDbError()` maps Postgres/PostgREST failures to readable Indonesian messages (e.g. duplicate keys, constraint names).
- The materi link field only accepts `http(s)` URLs (`normalizeDefenseLink`), since it renders as a `target=_blank` button on a public page.
- NPM fields accept digits only (DB-enforced `^[0-9]+$`); the sidang form looks up `students` by NPM.
- Grading: scores and rule values arrive from the client as text and are re-parsed and validated on the server (§6.13); `nilai` is always recomputed there. `unique (defense_id, peran)` is the last word on double submits, and the dosen lock and delete restriction live in the DB (§5.2). Sidang adds the yudisium pair check, the frozen rules and the post-lock refusal in triggers, and `kunci_sidang` keeps the Ketua's grade and the lock atomic (§6.14).

### 8.5 Secrets and keys

| Secret | Exposure |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Used by `admin.ts` (never bundled to the client). |
| `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` | Public by design; protected by RLS. |
| `ASPOSE_CLIENT_ID` / `_SECRET` | Server-only, used by the PDF route. |
| `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Server-only (Vercel env). `SMTP_PASS` is a Google App Password. Never in the repo, the database, the audit log or a log line (§9.7). |
| Day-login passwords | Generated server-side, shown once to the admin, stored nowhere but Supabase Auth's hash; never logged. |
| `lecturers.jadwal_token` | Secret URL segment; audit-stripped, export-stripped. |

---

## 9. Operations

### 9.1 Environment variables

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything |
| `SUPABASE_SERVICE_ROLE_KEY` | Pengguna page (account administration), auth audit entries, public `/jadwal-dosen` reads, storage management |
| `ASPOSE_CLIENT_ID`, `ASPOSE_CLIENT_SECRET` | PDF downloads on print pages (free tier: 150 conversions/month); without them the xlsx download still works |
| `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | The Nilai Sidang revisi email (Gmail SMTP). Without any one of them the send is recorded as `gagal` ("SMTP belum dikonfigurasi") and nothing else breaks. Setup in §9.7 |

`.env.example` documents the shape; `.env.local` holds real values locally.

### 9.2 Local development

```bash
npm install
cp .env.example .env.local     # fill in
npm run dev                    # http://localhost:3000
npm run lint                   # eslint
npx tsc --noEmit               # type check
npm run check                  # 22 pure-logic suites
npm run build                  # production build (also type-checks scripts/)
```

Conventions that keep the codebase consistent (validated by experience, see `AGENTS.md`):

- Read the bundled Next.js 16 docs before writing framework code; the file conventions (`proxy.ts`, typed `PageProps`/`RouteContext`) differ from older versions. New routes need `npx next typegen`.
- Keep business rules in pure modules (`src/lib`, `*.ts` next to pages) and pin them with a `check:*` suite.
- In check scripts, use named test functions instead of bare `{ … }` blocks (bare blocks have caused spurious `tsc` parse errors in this repo).
- UI text is Indonesian; code, comments and these docs are English.

### 9.3 Verification suites

`npm run check` runs 22 suites in sequence (Node `assert`, executed with `tsx`):

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
| `check:import` | Import engine: parsing, validation classes, template/export buffers, the Mahasiswa/Dosen grading columns and the absent-column rule |
| `check:jadwal-dosen` | Term-week math, `kuliahDates`, feed event assembly (incl. exdates), prasidang zoom label, the ICS `Penilaian:` line (prasidang and sidang) |
| `check:proxy` | Session gate: route skipping, redirects, fail-closed behavior, the DOSEN and narrower EKSTERNAL allowlists (redirect on GET, 403 on POST; no `/atur-kata-sandi` or bimbingan for EKSTERNAL) |
| `check:settings` | Settings loading (prodi + `all`), typed accessors, active-day parsing |
| `check:roles` | `loadCurrentUser` role/prodi/`kodeDosen` resolution (DOSEN and EKSTERNAL are S1 only; an expired EKSTERNAL is signed out), `canWrite`/`canManage`/`isDosen`/`isPenguji`, `generatePassword` |
| `check:ics` | RFC 5545 escaping, folding, calendar text |
| `check:tahun-akademik` | Academic-year save sequencing (each write recorded, one failure simulated) |
| `check:copy-year` | Rollover copy: previous-year resolution, copied rows/lecturers |
| `check:audit-log` | Log filters parsing and free-text search filtering |
| `check:defense-link` | Material-link normalization and labelling |
| `check:hari-libur` | Holiday→kuliah skipping in the combined calendar and the feed |
| `check:kalender` | Combined-calendar event building: parity, exam pauses, holidays, week counts |
| `check:nilai-bimbingan` | Grading rules validation and `loadAturan` fallback/throw, grading math and rounding, access rules, the DOSEN path allowlist, stale-aspek refusal, recap row building, delete/lock error messages |
| `check:nilai-sidang` | The two new rules and the frozen copy, Nilai Sidang / Nilai Akhir / IPK / predikat math (ABDURRAHMAN numbers, tepat-waktu step-down), sidang access rules, day-login username/password and `ensureAkunEksternal` races, revisi checks, email body (no grades) and send outcomes, sidang error messages, Nilai Akhir recap rows and xlsx |

Separately, `npm run check:db` starts a throwaway PostgreSQL 16 container, applies **every migration** and runs `scripts/check-prodi-db.sql` (the runner skips the two `pg_cron` migrations) — SQL-level assertions for the RLS policies (roles and prodi access), DOSEN isolation (every staff table reads empty), the grading rules seeds and policies (seven `s1` rules), the one-grade and window rules, and the dosen lock, plus for sidang: EKSTERNAL isolation and day expiry, Ketua-after-anggota, the lock trigger and frozen `aturan`, the yudisium pair check, `email_status`, the graded-sidang defense lock, and `kunci_sidang` atomicity, which the TS suites cannot see. It requires Docker.

### 9.4 Migrations and deployment

1. Write the migration in `supabase/migrations/` and append it to `supabase/all_in_one_setup.sql`.
2. Apply it to production **before or immediately with** the deploy — in this project, by pasting the file into the Supabase SQL editor (or `supabase db push` when using the CLI). Nilai Sidang adds `20261116000001_nilai_sidang.sql`, `20261116000002_eksternal_cleanup.sql` (needs `pg_cron`, so it only runs on Supabase) and `20261116000003_kunci_sidang.sql`; the code needs the first and third (the first for the tables and triggers, the third for `kunci_sidang`).
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
| Grading pages, recap, Pengaturan Penilaian | `aturan_penilaian` / `nilai_bimbingan` missing, or any DB error in `loadAturan` | The load throws (error boundary). Deliberate: defaulting would freeze a default aspek list into an immutable grade |
| Sidang grading page, Penilaian Saya, Nilai Akhir recap | `nilai_sidang` / `hasil_sidang` / `akun_eksternal` missing, or any DB error | The load throws (error boundary). Locking before `20261116000003` fails with a missing-function error and writes nothing |
| Revisi email | `SMTP_*` missing, Gmail unreachable or slow | The lock stands; `email_status` becomes `gagal` (or `sebagian`) with the reason per address, and Super Admin retries from the recap |
| Other pages | any schema error | Inline `humanDbError()` message (or error boundary for load failures) |

Rule of thumb: **public, read-only surfaces must never 500 over an enhancement**; admin surfaces may show the underlying error because a human is present to act on it.

### 9.6 Observability

- `audit_log` is the primary behavioral record (who changed what, when), with UI surfacing in §5.5.
- `humanDbError()` turns raw Postgres failures into actionable Indonesian text wherever an operation can fail.
- Vercel function logs capture server-side exceptions; the app itself has no APM integration.
- The revisi email's outcome is data, not a log line: `hasil_sidang.email_status` / `email_detail` (per-address result and reason), shown on the Nilai Akhir recap. SMTP credentials are never logged.

### 9.7 Email (SMTP) setup

The revisi email of a locked sidang is sent from the faculty Gmail account `akademik.psikologi10@gmail.com` over Google SMTP (`smtp.gmail.com`, port 465, TLS). The account owner does this once:

1. Turn on **2-Step Verification** on the Google account (an App Password is not offered without it).
2. Create an **App Password** (Google Account → Security → App passwords): app "Mail", name "Penjadwal" (any recognisable name). Copy the 16-character password; Google shows it once.
3. Add the three environment variables on the Vercel project (Settings → Environment Variables), for Production (and Preview if previews send mail):

   | Variable | Value |
   |---|---|
   | `SMTP_USER` | `akademik.psikologi10@gmail.com` |
   | `SMTP_PASS` | the App Password |
   | `SMTP_FROM` | `Akademik Fakultas Psikologi UP <akademik.psikologi10@gmail.com>` |

4. **Redeploy** the project: environment variables are read at runtime but only a new deployment picks up a changed value.

Notes:

- Real values live only in Vercel (and a developer's untracked `.env.local`); `.env.example` carries placeholders. Never commit them. If the App Password leaks, revoke it in the Google account and create another.
- A sidang locked before this is set up has its mail recorded `gagal` ("SMTP belum dikonfigurasi"); after step 4, Super Admin presses "Kirim ulang email" on the Nilai Akhir recap.
- Locally, put the same three variables in `.env.local` to send real mail; without them the app runs and records `gagal`.
- Gmail limits how many messages an account sends per day; one mail per locked sidang with revisi stays far below it.

---

## 10. Constraints, Assumptions and Future Work

### 10.1 Constraints and assumptions

- **Timezone**: scheduling times are wall-clock `Asia/Jakarta`; no DST handling (none needed).
- **Scale**: a few thousand rows per academic year; no caching layer, no partitioning, direct Postgres reads.
- **Single faculty / two programs**: prodi is a data dimension with fixed config in `prodi.ts` (`semesters`, `jenisKelas`, defense labels). A third program would extend that config plus the prodi check constraints.
- **Manual production migrations**: the main operational risk; mitigated by §9.5.
- **Aspose free tier**: 150 PDF conversions per month; the xlsx download is the always-available fallback.
- **No sign-up, no email reset**: accounts are admin-created; password changes are self-service via `/atur-kata-sandi`, and a Super Admin can set a new password for any account (the built-in mailer may not reach dosen).
- **Grades are final for the examiner**: no edit, unlock or delete path exists for a DOSEN or EKSTERNAL, and nobody can delete a grade or unlock a sidang. Corrections are Super Admin edits, recorded in the audit log (retained 1 month); a correction never re-sends the revisi email.
- **Day logins are admin-handed**: an EKSTERNAL password is shown once and given in person; there is no self-service reset, and a late examiner needs "Perpanjang" (Super Admin) or a new password.
- **Email depends on one Gmail account**: delivery is best-effort (10 s cap, one retry path); the lock never waits on it.
- **Audit retention**: 1 month (nightly pg_cron purge). Longer retention would need a change to the retention migration.
- **`next build` type-checks `scripts/`**: a broken check script fails the build, not just `npm run check`.

### 10.2 Future work (candidates, not commitments)

- Optional UI for rotating/revoking lecturer tokens per dosen (the SQL function exists; the Dosen page exposes generate/copy today).
- Bulk operations on the combined calendar (it is read-only by design).
- Automatic conflict solving — out of scope until product requirements demand it.
- Per-program holiday overrides (today holidays are faculty-wide by definition).
- Extending import/export to more tables as master data grows.
- Printing the berita acara and the revisi form; tracking whether a student completed the revisi.
- Sidang grading for S2 (Sidang Tesis).

---

## Appendix A — Recent feature notes (for orientation)

These behaviors are recent and worth knowing when reading the code:

- **Riwayat Perubahan**: `/log-aktivitas/riwayat?tabel=…&id=…`; helpers in `src/lib/audit-history.ts`; entry point from the Log Aktivitas detail modal.
- **Materi link** on defenses: DB `chk_defenses_link`, form validation `normalizeDefenseLink`, render `defenseLinkLabel`, public page button ("Lihat Materi" on Drive hosts), ICS `description`; intentionally absent from Cetak.
- **Kalender Gabungan**: `/kalender` (no filters, year + week navigation), pure builder in `src/app/kalender/items.ts`. Note: this path must not be added to legacy redirects.
- **Hari Libur**: `holidays` table + `src/lib/hari-libur.ts`; kuliah skips in feed/calendar, ujian/sidang form warnings; management UI on `/tahun-akademik`.
- **Nilai Sidang**: `/nilai-sidang/[defenseId]`, the RPC `kunci_sidang`, the `set_hasil_sidang_locked` trigger, `src/lib/penilaian/{nilai,akses,aturan}.ts` (sidang half), `src/lib/mailer.ts`. The lock freezes the rules in the DB; the email runs after the commit.
- **Day logins**: `EKSTERNAL` role, `akun_eksternal`, `src/lib/penilaian/akun-eksternal.ts`, `/[prodi]/sidang/akun-eksternal`; the proxy and `halamanDosen(path, role)` carry the narrower allowlist.
- **Prasidang Zoom on the public feed**: `Kelompok N · Zoom <id> · Passcode <passcode>` from `prasidang_zoom_*` settings; falls back to `Kelompok N (Zoom)`.

## Appendix B — Document history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-17 | Initial TSD, written against the working tree that includes Kalender Gabungan, Hari Libur, Riwayat Perubahan, the materi link and the public-feed hardening. |
| 1.1 | 2026-11-09 | Hub "Perubahan Terbaru" strip removed; Log Aktivitas is reached from the hub's "Lainnya" line. |
| 1.2 | 2026-11-13 | Nilai Bimbingan: DOSEN role with proxy allowlist and `is_staff()` RLS isolation, `aturan_penilaian` and `nilai_bimbingan` tables, Mahasiswa/Dosen master fields, grading, recap and rules routes (§6.13), admin password reset, `check:nilai-bimbingan`. |
| 1.3 | 2026-11-14 | Nilai Sidang and Nilai Akhir: EKSTERNAL day logins (`profiles.berlaku_sampai`, `akun_eksternal`, expiry in SQL, proxy and sign-in, Akun Penguji Eksternal page, nightly cleanup), `nilai_sidang` / `hasil_sidang` with the hardening pattern, the Ketua lock via `kunci_sidang` and DB-frozen rules, aspek sidang and yudisium rules, Nilai Akhir / IPK / predikat math, revisi email over Gmail SMTP (§9.7), Nilai Akhir recap and Excel, `check:nilai-sidang` (§6.14). |
