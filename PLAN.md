# KRS Scheduling — Implementation Plan

Source: `docs/Kebutuhan Penjadwalan KRS.pdf`, two schedule PDFs, lecturer-list screenshot.

## 1. What this is

An admin tool for a study program (S1 Psikologi) to build the per-semester
course schedule (KRS), detect lecturer/room/class clashes, and print two
documents:

1. The class schedule sheet (grouped by Kelas A/B/C, with header + signature footer).
2. A per-lecturer teaching recap with total SKS.

There are no student-facing screens in the requirements. One admin role.

## 2. Data model

Supabase Postgres. Seven tables plus a settings table — a few thousand rows per
academic year, so no partitioning, no caching layer, no ORM.

| Table | Columns |
|---|---|
| `courses` | `kode_mk` (PK), `nama_mk`, `sks`, `smt` (1–8), `jenis_mk` (A wajib / B pilihan), `kurikulum` (2026, …) |
| `lecturers` | `kode_dosen` (PK), `nidn` (text), `nama`, `gelar_depan`, `gelar_belakang` |
| `rooms` | `id`, `nama` (301, Lab. Kom), `kapasitas`, `keterangan`, `active` |
| `academic_years` | `id` (e.g. `20261` = 2026/2027 Gasal), `label`, `is_active` |
| `sessions` | `id`, `hari`, `sesi_ke`, `jam_mulai`, `jam_selesai`, `sks`, `active` — generated from settings, editable |
| `schedules` | `id`, `academic_year_id`, `jenis_kelas` (reguler/regsus), `semester_ke`, `kode_mk`, `kelas` (A–Z), `hari`, `jam_mulai`, `jam_selesai`, `room_id`, `zoom_id`, `jumlah_mhs`, `minggu` (setiap/ganjil/genap), `keterangan` |
| `schedule_lecturers` | `schedule_id`, `kode_dosen`, `urutan` — zero rows means MKWU |
| `settings` | `key` (PK), `value`, `type` (`int`/`time`/`text`/`bool`/`image`), `group`, `label`, `help`, `urutan` — one row per setting, seeded with the keys in §3.1 |

Uniqueness: `(academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas)`.

Prodi is fixed to S1 Psikologi, so it lives in `settings` as a label used by the
print header — not a column, not a picker. If a second prodi ever appears, it
becomes a column on `schedules` and a filter; nothing else in the model moves.

Reguler and Reguler Khusus are the `jenis_kelas` flag on each schedule row. One
schedule list, one clash check across both — a lecturer teaching regsus at 18.00
must still not collide with anything else that evening — and the recap splits
them into the two sections your printed sheet shows.

## 3. Pages

### 3.1 Master data

Three tables share one import mechanism, so it gets built once and reused:
**download a template → fill it in Excel → upload → dry-run preview showing new /
changed / unchanged / rejected rows → commit**. The template is generated from
the live column list, so it can never drift from what the importer accepts, and
it ships with one example row. Nothing is written until the preview is confirmed,
and the commit runs in a Postgres function so a half-applied import cannot exist.

- **Mata Kuliah** — table + CRUD + import. Columns exactly as
  `docs/db matakuliah.xlsx` exports them: `kode_mk, nama_mk, sks, jenis_mk, smt,
  semester, kurikulum`. Upsert by `kode_mk`. `semester` (Gasal/Genap) is derived
  from `smt` parity, so it is accepted on import and not stored. `jenis_mk` B
  means mata kuliah pilihan — that is what the `(P)` suffix in a course name
  encodes, so the suffix is stripped on import and the flag carries it. Seeded
  with all 71 rows of that file.
- **Dosen** — same pattern. Columns exactly as `docs/db dosen.xlsx` exports
  them: `No, Kode Dosen, NIDN, Nama Dosen, Glr Dpn, Glr Blkg`. Upsert by
  `Kode Dosen`; `No` is a row counter and is ignored.

  **NIDN is text, never a number.** The supplied export has it as a numeric cell,
  so `0311106301` reads back as `311106301` — the leading zero is gone. The
  template marks the column as text, and the importer left-pads any NIDN shorter
  than 10 digits and shows it in the preview so the admin can see what was
  repaired. A silently truncated NIDN is a wrong government identifier on a
  printed document.

  **The display name is built, not stored.** `Glr Dpn` + `Nama Dosen` +
  `Glr Blkg` concatenated reproduces the schedule sheets exactly — "Dr." +
  "Evanytha" + ", M.Si., Psikolog" gives "Dr. Evanytha, M.Si., Psikolog", the
  string the printed schedule carries. `Glr Blkg` already starts with its comma,
  so it is appended with no separator, and the importer trims the stray space
  some rows have (", M.Si." vs ",M.Si."). Name casing is inconsistent in the
  export — "Silverius Y Soeharso" beside "ENDANG MARIANI RAHAYU" — and is stored
  as given, since a printed schedule should match the registrar's own records.

  The file you supplied holds 4 rows, so it is a sample rather than the list. The
  seed provides display names harvested from the schedule sheets with blank
  codes; uploading the real export fills them in rather than duplicating, matching
  on the de-titled name (see §6b). That matching is load-bearing: `6009230025`
  builds to "Dr. Seta Ariawuri Wicaksana, S.Psi., M.Psi., M.M., Psikolog", which
  is the SMTR V spelling, while the SMTR I sheets call the same person "Dr. Seta
  A Wicaksana, M.Psi., MM., Psikolog".
- **Ruangan** — same pattern. Columns `nama, kapasitas, keterangan`. Upsert by
  `nama`. Rooms in the printed schedule are 301, 302, 303 and Lab. Kom.
- **Pengaturan** — every number the scheduling rules depend on lives here, not in
  the code. See §3.1b.

- **Sesi Perkuliahan** — the gap the reference system has: the end time is not
  computed. Here, pick day + start time + SKS and the end time is derived
  (`sks * menit_per_sks`). A "Generate sesi" action fills a whole day from a
  start time, an SKS pattern and a break length — all four read from settings, so
  retuning the timetable is a settings edit, not a code change. Reguler starts at
  07.30 and regsus at 18.00, so the generator runs one block per start time
  rather than one per day.
  Rows stay individually editable and the schedule form can always override the
  computed time by hand — the real 2026/2027 sheet is full of slots that do not
  match the formula, and the app has to be able to hold them.

### 3.1b Pengaturan

No rule value is hardcoded. `settings` is one row per setting — key, value, type,
group, label, help text — and the page renders a labelled field per row from the
`type`, grouped into sections. Adding a setting later is an insert, not a
migration and not a form change. Values are read once per request and cast on
read; the seed ships every key below with the value the current schedule uses.

**Waktu & sesi**

| Key | Default | Used by |
|---|---|---|
| `menit_per_sks` | 50 | end-time calculation, session generator |
| `jeda_menit` | 10 | gap between consecutive sessions |
| `jam_mulai_reguler` | 07.30 | session generator, reguler block |
| `jam_mulai_regsus` | 18.00 | session generator, regsus block |
| `jam_istirahat_mulai` | 12.10 | the midday gap the generator skips over |
| `jam_istirahat_selesai` | 13.00 | same |
| `hari_aktif` | SENIN…SABTU | which days appear in the day picker |

**Kelas**

| Key | Default | Used by |
|---|---|---|
| `kelas_maksimal` | Z | the last letter offered in the Kelas dropdown |
| `maks_mahasiswa_per_kelas` | 50 | advisory warning on `jumlah_mhs` |
| `min_mahasiswa_pilihan` | 10 | advisory warning on elective courses |

Both counts are warnings only — you said `jumlah_mhs` is not enforced, and the
numbers come from the KETERANGAN block on your printed sheet, so they belong
where that text can be kept in step with them.

**Bentrok**

| Key | Default | Used by |
|---|---|---|
| `bentrok_dosen` | blok | whether a lecturer clash blocks, warns, or is ignored |
| `bentrok_kelas` | blok | same for a class clash |
| `bentrok_ruangan` | peringatan | same for a room clash |
| `izinkan_override` | ya | whether a blocking clash can be saved with a reason |

**Cetak**

| Key | Default |
|---|---|
| `nama_universitas` | Universitas Pancasila |
| `nama_fakultas` | Fakultas Psikologi |
| `kota` | Jakarta |
| `nama_prodi` | S1 Psikologi |
| `zoom_id` / `zoom_passcode` | 560 278 1304 / 2026 |
| `header_baris` | the four header lines, with `{semester}`, `{angkatan}`, `{tahun_akademik}` placeholders |
| `keterangan_cetak` | the three KETERANGAN lines |
| `nama_penandatangan` / `jabatan_penandatangan` | FARIDA AINI, M.PSI., PSIKOLOG / KETUA PROGRAM STUDI |
| `gambar_tanda_tangan` | uploaded image, optional |
| `ukuran_kertas` / `orientasi` | A4 / portrait |

### 3.1c Masuk (login)

Mockup: `desain/login.html`. Supabase Auth, email and password, and nothing else
on the page.

**No sign-up.** Accounts are created from the Supabase dashboard, so the page
says who to ask instead of showing a link that leads nowhere. `signUp` is
disabled in the Supabase project so the endpoint cannot be reached either.

What the page has to get right, because each one is a state that gets skipped:

- **Failed sign-in.** Supabase returns `Invalid login credentials` for both a
  wrong password and an unknown email — deliberately, so the form cannot be used
  to discover who has an account. The page shows one message for both and never
  narrows it down.
- **Rate limiting.** Supabase throttles repeated failures. The error says so up
  front rather than letting someone hit an unexplained wall on the sixth try.
- **Password reset.** `resetPasswordForEmail` sends a link; the confirmation is
  worded the same whether or not the address exists, for the same reason.
- **Show/hide password**, because these are provisioned passwords people retype.
- **Session length** is stated on the page. Supabase refresh tokens are
  long-lived by default, and an admin sharing an office computer should know
  what staying signed in means.
- **The text size control is on this page too** — the head of study program sets
  it before signing in, and the choice is in `localStorage`, so it survives
  sign-out.

Routing: middleware redirects to `/masuk` when there is no session, and away from
it when there is. The redirect carries the originally requested path so a
bookmarked schedule opens after sign-in.

### 3.2 Penjadwalan (the core screen)

Flow: pick academic year → pick jenis kelas (reguler / reguler khusus) → pick
semester (1–8). Everything below that is one work surface: a form on one
side, the growing schedule table on the other, so the admin never leaves the page
between entries.

Form fields, in the doc's order: Mata Kuliah (searchable, shows `kode — nama — sks`),
Sesi (filtered to sessions whose SKS matches the course, with a free-time escape
hatch), Kelas (A–Z), Dosen, Ruangan (from the room list), Zoom ID, Jumlah
Mahasiswa, Minggu. Everything after Dosen is optional.

**Minggu** is setiap / ganjil / genap, and it only appears for Reguler Khusus,
where alternating weeks are how two courses share one evening slot. It defaults
to setiap. On the printed sheet it renders as the `(A)` and `(B)` suffix after
the course name, which is the notation the current sheet already uses.

Dosen is a repeatable field, not a fixed Dosen1–Dosen5 as in the reference
screenshot. Team teaching is real; this semester simply has none, so every seeded
row gets exactly one. Add-a-lecturer grows the list, and clash detection runs per
lecturer.

Leaving Dosen empty means MKWU: the row saves, the print shows `MKWU`, and clash
detection skips it, since university-wide courses are staffed outside this program.

**Clash detection** runs on every change to the form, not only on save. Three
kinds, all resolved by one overlap query on `(hari, jam_mulai, jam_selesai)`
within the same academic year, across reguler and regsus together:

1. **Dosen bentrok** — the same lecturer in two places at overlapping times.
2. **Kelas bentrok** — the same semester + jenis kelas + kelas already has a course then.
3. **Ruangan bentrok** — the same room from the room list, unless the room is blank.

Two rows only overlap if their weeks can collide: `setiap` collides with
everything, `ganjil` and `genap` collide with `setiap` and with themselves, never
with each other. Without that clause the seed reports four conflicts that are not
conflicts.

Whether each one blocks, warns, or is ignored is a setting (§3.1b) — the defaults
block lecturer and class clashes and warn on rooms. Each is shown inline naming
the conflicting entry (course, class, lecturer), not as a generic error. The same checks run server-side on save — the
live check is for speed, not for trust.

Override is on by default and itself a setting. The existing schedule already contains
ones that are deliberate and ones that are mistakes (see §7), and a tool that
refuses to store the schedule you actually run is a tool you stop using. So a
clash blocks the *default* save, an override records who accepted it and why, and
overridden rows stay flagged in the list view so they can be reviewed before
printing.

The schedule table below the form shows kode MK, MK, SKS, hari, jam, dosen,
ruangan, zoom, and per-row edit/delete, grouped by kelas with an SKS subtotal.

### 3.3 Cetak Jadwal

Print view reproducing the layout of the existing PDF: header block (title,
angkatan, academic year, zoom ID + passcode), one table per kelas, the
`KETERANGAN` notes, and the signature block. Rendered as a normal page styled
with `@media print` — no PDF library, the browser prints it. The signature image
is an upload in settings, optional.

### 3.4 Rekap Dosen

Pick a lecturer (or print all), see their teaching rows split into Kelas Reguler
and Kelas Reguler Khusus with a total SKS per section and overall, matching the
recap photo. Same print treatment.

## 4. Design direction

Chosen: **Bilah** — the findings bar. Mockups at `desain/2b-bilah.html` and
`desain/login.html`; open them in a browser, they are self-contained. Product picked it over a right-hand findings
panel and a findings-first landing page.

### The idea

The schedule table keeps the full width of the window. Above it sits a bar that
holds every problem found across the whole academic year — not just the class on
screen. Each finding is one line: where it is, what collides, how many minutes
they overlap, and a Resolve link. The bar collapses when the admin wants the
table alone.

This puts the app's actual value on screen at all times. A CRUD table that
happens to validate on save would bury it.

Findings read as sentences with their consequence attached — "Penulisan Ilmiah
and Kewarganegaraan run at the same time on Friday — both are required." The
last clause is what tells the admin whether it matters; an elective colliding
with a required course is a different problem from two required courses
colliding, and the interface says so rather than making them look identical.

### The system

| | |
|---|---|
| Typography | IBM Plex Sans, 15px base; IBM Plex Mono for codes, times and SKS |
| Type scale | 1.2 ratio, expressed in rem — caption 12 · small 14 · body 15 · h1 24 |
| Text size | A control in the top bar: 15 / 17 / 19px root, remembered per browser |
| Density | 4px base unit, 39px table rows. Dense enough to work in, loose enough to read |
| Depth | Borders only, low-opacity. No shadows anywhere |
| Radius | 3px controls, 5px containers |
| Color | Ballpoint blue `#1A3FA0` for action and active state; red `#A81E14` for clashes; cool grey for structure. Colour only ever means status — never decoration |
| Contrast | Muted text `#5C6474` (5.9:1 on white). Every text tier clears WCAG AA at the smallest size |
| Focal point | The clash count, then the finding list |
| Motion | 120–160ms, `cubic-bezier(.23,1,.32,1)`, `scale(.97)` on press, `prefers-reduced-motion` honoured |

Tokens are named for this world (`--kertas`, `--lembar`, `--tinta`, `--garis`,
`--biru`, `--merah`), not `--gray-700`.

### Two readers, one screen

The admin staff enter about 96 rows a semester and want density. The head of
study program reads the same screen to check and sign, and needs the type
larger. Sizing for one penalises the other, so size is a control rather than a
fixed value.

Every dimension in the interface — type, row height, padding, control heights —
is expressed in `rem`, so the root font size is a single lever. The top bar
carries an A / A / A control at 15, 17 and 19px, remembered per browser in
`localStorage` behind a try/catch. Nothing else changes: the layout, hierarchy
and density ratios hold at all three sizes.

Baseline accessibility that comes with it, and is not optional later: every
control clears a 40px hit area at the smallest setting, muted text sits at 5.9:1
rather than the 4.4:1 it started at, focus rings are visible on every
interactive element, and `prefers-reduced-motion` drops the transitions.

Rejected on the way: a sidebar-plus-cards-plus-DataTable layout (both the SIAKUP
reflex and the generic SaaS one), a week calendar grid of coloured blocks, and a
row of metric tiles across the top — this app has no number worth a tile.

### Institution

Universitas Pancasila, Jakarta — Fakultas Psikologi, program studi S1 Psikologi.
The name appears in the app chrome and above the sign-in form, and is held in
settings (`nama_universitas`, `nama_fakultas`, `kota`, `nama_prodi`) rather than
written into the markup, so the print header can draw on the same values.

Note that the current printed schedule does **not** carry the university name —
its header is only the semester, angkatan, academic year and Zoom ID. The seed
keeps it that way. Adding the institution to the printed sheet is a settings
edit, not a code change, whenever the program wants it.

No logo or seal is used. Reproducing a university mark needs the real asset and
permission to use it; text is correct until someone supplies both.

### Language

Interface copy is English. Three things stay as they are:

- **Course and lecturer names** are data from the imports, not copy. Translating
  them would break the match with the printed sheet.
- **`SKS`, `MKWU`, `Reguler`, `Reguler Khusus`** are identifiers that appear on
  the signed document.
- **Days display in English but print in Indonesian** — the app shows "Friday",
  the signed sheet says "JUMAT". A real split, not an oversight.

## 5. Stack

Next.js (App Router) on Vercel, Supabase Postgres, Supabase Auth. Server actions
for mutations, Tailwind for styling, `xlsx` for import. No ORM — `@supabase/supabase-js`
against typed tables is enough for CRUD this shape. No separate API, no state
library, no component kit; the UI is tables and forms.

**Auth.** Supabase Auth with email + password, no sign-up page — the admin
accounts are created from the Supabase dashboard. Middleware guards every route
except the login page. Session handled by `@supabase/ssr` cookies.

**Access rules.** RLS on every table: authenticated users read and write, anon
reads nothing. That is the honest shape of a single-role internal tool, and it
means no service-role key ever reaches the browser. Writes that need to be atomic
— the import commit and the clash-checked schedule insert — run in Postgres
functions so a half-finished import cannot exist.

**Clash detection** is a single overlap predicate, so it belongs in the database:
an exclusion-style check in the insert/update function plus a unique index on
`(academic_year_id, jenis_kelas, semester_ke, kode_mk, kelas)`. The UI's live
check is the same query run early for speed; the function is what actually
guarantees it. Two clients saving at once cannot both win.

## 6. Build order

1. Supabase project, schema migration, RLS policies, seeded settings + academic year.
2. Auth: login page, middleware, session handling.
3. The shared Excel import: template download, dry-run preview, atomic commit.
4. Master data screens on top of it: mata kuliah, dosen, ruangan.
5. Pengaturan page + the settings reader every other screen uses.
6. Session generator (sesi jam), driven by those settings.
7. Scheduling screen without clash detection.
8. Clash detection — DB function plus live UI check. The part that gets tests.
9. Print: schedule sheet.
10. Print: lecturer recap.
11. Seed the 2026/2027 Gasal data (see below).
12. Design pass across all screens.

## 6b. Seed data

Source: `docs/Jadwal Perkuliahan Gasal 2026 2027_Final+jml mhs.xlsx`. Six usable
sheets for academic year 2026/2027 Gasal:

| Sheet | Jenis | Semester | Angkatan | Kelas | Rows |
|---|---|---|---|---|---|
| SMTR I | Reguler | 1 | 2026 | A, B, C | 27 |
| SMTR III | Reguler | 3 | 2025 | A, B | 20 |
| SMTR V | Reguler | 5 | 2024 | A, B | 20 |
| SMTR I - RK | Regsus | 1 | 2026 | A | 9 |
| SMTR III - RK | Regsus | 3 | 2025 | A | 10 |
| SMTR V - RK | Regsus | 5 | 2024 | A | 10 |

`Sheet1` is an older, unlabelled schedule with different course codes and 08.00
start times. Not imported.

The course table is `docs/db matakuliah.xlsx`, all 71 rows, and nothing else.
Schedule rows for semesters III and V are translated to those codes on seed via
the table in §7b. The `(P)` suffix in a course name marks a mata kuliah pilihan
and becomes `jenis_mk` = B, not part of the name.

Lecturers are the gap. The sheets carry only display names, and the same person
appears under several spellings — "Ni Made Rai Kistyanti, M.Psi., Psikolog" and
"Ni Made Rai Kistyanti, S.Psi, M.Psi.,Psikolog", "A. Eka Septilla AM, M.Psi.,
Psikolog" and "A. Eka Septilla AM, S.Psi, M.Psi.,Psikolog", "Dr. Seta A
Wicaksana, M.Psi., MM., Psikolog" and "Dr. Seta Ariawuri Wicaksana, S.Psi.,
M.Psi., M.M., Psikolog". Import matches on the name stripped of titles and shows
every near-match for confirmation rather than silently creating duplicates —
a duplicated lecturer is invisible to clash detection, which is the one thing
this app exists to do. `kode_dosen` and `NIDN` are only in the SIAKUP screenshot,
cut off at 12 rows, so a real export is needed (see §8).

## 7. What the real data says

Running the clash rules over all 96 rows of the 2026/2027 sheets, with the week
parity clause in place, finds nine overlaps. Four are combined classes, five are
real.

**Kelas gabungan — not conflicts (4).** The same elective, the same lecturer,
taught to kelas A and kelas B at once, which the sheet's own KETERANGAN allows
("KELAS GABUNGAN, MAKSIMAL 1 KELAS 50 ORANG"): Psikologi Remaja (P) and Psikologi
Perilaku Seksual (P) in semester III, Psikologi Forensik (P) and MSDM Berbasis
Kompetensi (P) in semester V. Three of the four pairs carry identical times; the
fourth is typed slightly differently for each class — Psikologi Remaja is
15.40–17.10 for kelas A and 15.20–16.50 for kelas B — so exact matching would
miss it. The app treats "same course, same lecturer, overlapping time, different
kelas" as a probable combined class and offers to record it as one session
serving both, instead of reporting a clash.

**Real conflicts in the current schedule (5).** These are what the tool exists to
catch, and they are all in the source data today:

| Sheet | Kelas | Bentrok |
|---|---|---|
| SMTR I | C | Penulisan Ilmiah and Kewarganegaraan, both Jumat 13.00–14.40 |
| SMTR I - RK | A | Bahasa Indonesia 18.00–19.40 inside Filsafat 18.00–20.30, Kamis |
| SMTR I - RK | A | Pancasila 19.50–21.30 overlaps Filsafat 18.00–20.30, Kamis, by 40 min |
| SMTR III - RK | A | Psikologi Pendidikan 18.00–20.30 overlaps Psikologi Remaja (P) 19.50–21.30, Senin, by 40 min |
| SMTR III - RK | A | Psikologi Industri & Organisasi and Psikologi Perilaku Seksual (P), Selasa 18.00, both minggu genap |

The first three pair two compulsory courses, so a student cannot attend both. The
last two involve an elective, so they hurt only the students who chose it. All
five seed as accepted overrides with the reason "bentrok pada data sumber
2026/2027" so they are visible on day one rather than silently imported.

Other things the sheets settle:

1. **Times often do not match the SKS formula.** Psikologi Industri &
   Organisasi is 3 SKS in a 100-minute slot (13.30–15.10); Psikologi Klinis 3
   SKS likewise; Psikologi Kepribadian II is 2 SKS in 90 minutes. Filsafat ends
   at "15.31", a typo. The formula drives the *default*, never a validation.
2. **`(A)` and `(B)` mean week parity.** Confirmed by product: on Reguler Khusus,
   `(A)` is minggu ganjil and `(B)` minggu genap. Six rows carry it, all in the
   two RK sheets. It is what lets Dr. Vinaya hold Psikologi Sosial and Metodologi
   Penelitian Eksperimen in the same Kamis 18.00 slot, and Psikologi Sekolah and
   MSDM share Jumat 18.00–19.40.
3. **Student counts are per row, not per class** — within SMTR III kelas A they
   run 27, 28, 29, 30, and electives drop to 5. Stored per schedule row, shown
   in the table and the print, never enforced.
4. **Regsus runs evenings and Saturdays** — 18.00–21.30 on weekdays, mornings on
   SABTU. The session generator has to cover both patterns.
5. **Only odd semesters** appear, as expected for a Gasal term: 1, 3, 5. The
   semester picker still offers 1–8.

## 7b. One code system: the 2026 curriculum

`docs/db matakuliah.xlsx` is the system of record. Its 71 codes are the only
course codes stored; the older `60321…`, `60521…` and `100520…` codes that
semesters III and V use in the schedule sheets are translated on seed and then
discarded.

Of the 29 distinct codes in the schedule sheets, 9 are already 2026 codes (all
Semester I). The other 20 map as follows; all 20 resolve.

| Kode lama | Mata kuliah (jadwal) | Kode 2026 | Catatan |
|---|---|---|---|
| 10052012 | Kewirausahaan | 15152002 | — |
| 10052013 | English for Occupational Purpose | 15152007 | nama jadi "Purposes" |
| 10052014 | Kepancasilaan | 15152003 | — |
| 60321001 | Pengantar Tes Psikologi | 15133004 | — |
| 60321002 | Metodologi Penelitian Eksperimen | 15142001 | kurikulum smt 4 |
| 60321003 | Psikologi Kepribadian II | 15132005 | — |
| 60321004 | Psikologi Klinis | 15132006 | **SKS 3 → 2** |
| 60321005 | Psikologi Pendidikan | 15123006 | kurikulum smt 2 |
| 60321006 | Psikologi Sosial | 15133008 | **SKS 4 → 3** |
| 60321007 | Psikologi Kesehatan | 15152009 | kurikulum smt 5 |
| 60321008 | Psikologi Industri & Organisasi | 15143007 | kurikulum smt 4; nama "dan" |
| 60321009 | Psikologi Perilaku Seksual (P) | 15162010 | kurikulum smt 6 |
| 60321010 | Psikologi Remaja (P) | 15152014 | kurikulum smt 5 |
| 60521004 | Asesmen Bakat dan Inteligensi | 15143009 | kurikulum smt 4 |
| 60521005 | Psikologi Orang Dewasa/Pelatihan | 15162002 | nama jadi "Pelatihan"; kurikulum smt 6 |
| 60521006 | Psikologi Bisnis I | 15143005 | kurikulum smt 4 |
| 60521007 | Metode Konstruksi Alat Ukur | 15153001 | — |
| 60521008 | Psikologi Sekolah | 15152008 | — |
| 60521009 | MSDM Berbasis Kompetensi (P) | 15152012 | — |
| 60521011 | Psikologi Forensik (P) | 15152010 | — |

Three consequences:

1. **A course's curriculum semester is not the semester it is taught in.** Nine
   of the mapped courses sit at a different `smt` in the 2026 curriculum than the
   sheet that schedules them — Psikologi Kesehatan is a semester 5 course being
   taught to semester 3, because angkatan 2025 followed an older plan. So
   `schedules.semester_ke` stands on its own and is never derived from
   `courses.smt`. The course picker defaults to the courses whose `smt` matches
   the chosen semester, with a "tampilkan semua" escape, because the real
   schedule needs the ones that do not match.

2. **One course changes name on the printed sheet.** `60521005` "Psikologi Orang
   Dewasa/Pelatihan" becomes `15162002` **Pelatihan**, confirmed by product. The
   printed schedule for angkatan 2024 will read "PELATIHAN" where it used to read
   the longer name.

3. **Two courses change length.** Psikologi Klinis goes 3 SKS → 2 and Psikologi
   Sosial 4 SKS → 3. Following the curriculum shortens their sessions by 50 and
   50 minutes, which changes the printed schedule for angkatan 2025. The seed
   keeps the times exactly as the sheet has them and flags both rows as
   "durasi tidak sesuai SKS", rather than silently moving a class.

4. **`kurikulum` stays a column on `courses`** even with one code system, because
   the file carries it and the next curriculum revision will add codes beside
   these rather than replace them.

## 8. Open questions

Answered: Vercel + Supabase (Postgres + Auth); single prodi (S1 Psikologi);
team teaching is real, so lecturers are a repeatable field; seed 2026/2027 Gasal
only, no past years;
reguler/regsus as a flag on the schedule row; seed from the 2026/2027 xlsx;
regsus `(A)`/`(B)` means minggu ganjil/genap, so `minggu` is a column and clash
detection skips rows whose weeks alternate; course codes follow
`db matakuliah.xlsx` (2026 curriculum) with the older codes remapped on seed;
`jumlah_mhs` is display-only with no 50-per-class enforcement; MKWU prints as the
literal word with no lecturer record; signature image uploaded in settings; 2–3
admin accounts already created in Supabase; no SIAKUP export available, so dosen
and ruangan are both loaded through the template-download / Excel-upload flow.

Nothing blocks the build. One thing to settle before the print pass, and two
notes.

1. **Ruangan** — the room column is empty throughout the xlsx, while the printed
   PDF shows 301, 302, 303 and Lab. Kom. The room list is uploaded through the
   Excel template flow, so this resolves itself; the seed simply leaves
   `room_id` empty, and the printed sheet shows a blank room column until you
   upload the list and fill it in.

2. **Two courses get shorter** when the curriculum's SKS is applied — Psikologi
   Klinis 3 → 2 and Psikologi Sosial 4 → 3 (§7b). The seed keeps the times your
   sheet has and flags both rows, so nothing moves on its own; someone should
   decide whether the 2026/2027 schedule is corrected or left as printed.

3. **Five real conflicts** sit in the 2026/2027 data (§7), three of them between
   two compulsory courses. They seed as accepted overrides so they are visible
   rather than silently imported.
