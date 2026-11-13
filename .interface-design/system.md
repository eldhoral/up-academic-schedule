# Course Scheduling — Design System ("Bilah")

Universitas Pancasila, S1 Psikologi. Internal admin tool, one role, dense
data-entry work. Source mockups: `desain/2b-bilah.html`, `desain/login.html`.
Full rationale in `PLAN.md` §4.

## Direction and feel

Findings bar over a full-width table, not a CRUD form with validation bolted
on — the app's value (catching clashes) stays visible at all times. Cool,
structural, technical: a registrar's ledger, not a SaaS dashboard. Colour is
scarce and only ever means status.

The app is three schedules behind one menu: **Jadwal Mata Kuliah & Dosen**
(kuliah), **Jadwal UTS & UAS** (ujian) and **Jadwal Prasidang & Sidang**
(sidang), plus the shared admin: Data Master, Manajemen Pengguna, Audit Log.
All three schedules keep the same promise as kuliah: a standing findings bar
over a ledger-like surface, so clashes are visible without being looked for.
See "Menu hub and sections" below, and `PLAN.md` §9 for the roadmap.

## Tokens (`src/app/globals.css`)

Every color traces to a named token — no raw hex in component code.

```
--kertas #F2F3F5      page background
--lembar #FFFFFF      card/surface background
--cekung #F7F8FA      inset fields, table header band
--garis / --garis-kuat        rgba(16,24,40,.11 / .22)  borders, low-opacity
--tinta / --tinta-2 / --tinta-3   #0E1626 / #3C4657 / #5C6474   text hierarchy
--biru #1A3FA0 · --biru-lembut #EAEEF9 · --biru-hover #16358A · --biru-disabled #46589B
--merah #A81E14 · --merah-lembut #FDF0EE · --merah-garis #E0A79F · --merah-teks #7A1710
--hijau #17683F · --hijau-lembut #EAF6EE
--kuning #8A5A00 · --kuning-lembut #FFF6E5 · --kuning-garis #F0D08A   (peringatan / warning tier)
--r-kecil 3px (controls) · --r-sedang 5px (containers)
```

`--merah-teks` is for body text sitting on a `--merah-lembut` background —
`--merah` itself is reserved for icons, links and accents; using it as text
on a tinted background under-contrasts. Same relationship for the `--kuning`
family (added in the phase-12 pass to replace ad-hoc hex that had drifted
into three files).

## Depth

Borders only. No shadows anywhere — this was violated once (a stray
`shadow-sm` on the login page's forgot-password modal) and fixed in the
phase-12 pass. Every modal across the app is `border border-[var(--garis-kuat)]`
with no shadow.

Custom popups (the `Select` dropdown, below) follow the same rule: the popup
is `border border-[var(--garis-kuat)]`, no shadow, even though it's a
floating element that would conventionally get one.

## Tailwind v4: custom base CSS must be `@layer base`-wrapped

Per the CSS Cascade Layers spec, unlayered rules always beat every `@layer`'d
rule regardless of specificity or source order. `globals.css`'s custom rules
(`html`, `body`, `a`, `button/input/select` resets, etc.) were written as
plain unlayered CSS sitting next to `@import "tailwindcss"` — so
`a{color:var(--biru)}` silently out-ranked every `text-[var(--tinta-2)]`
utility applied to a link or `next/link`, no matter how specific. Fixed by
wrapping the whole custom block in `@layer base { ... }`. Any future custom
global CSS added to this file must go inside that same block, or it will
silently win over Tailwind utilities again.

## Type & density

- Font: IBM Plex Sans (`--font-sans`), IBM Plex Mono (`--font-mono`) for
  codes/times/SKS via the `.mono` class (`font-variant-numeric: tabular-nums`).
- Root size is the one lever: 15/17/19px via `html[data-teks]`, controlled by
  `TextSizeController`, persisted to `localStorage` behind try/catch. Every
  dimension in the app is `rem`, so this rescales the whole interface — never
  hardcode `px` for anything that should scale with it.
- Two density rhythms coexist, both internally consistent:
  - **Penjadwalan / Cetak Jadwal**: copied verbatim from the Bilah mockup —
    `td` padding `.27rem .53rem`, row height `2.6rem` (39px).
  - **CRUD list pages** (Mata Kuliah, Dosen, Ruangan, Sesi): a tighter,
    self-consistent rhythm — `.6rem/.4rem` padding used for table cells,
    inputs and buttons alike, `2.4rem` (36px) rows. These screens weren't in
    the original mockup; this rhythm was chosen for them and held
    consistently rather than mixed per-page.

## Component patterns

- **AppHeader** (`src/components/AppHeader.tsx`) — logos (a link to the menu),
  the section nav (`HeaderNav`, below), text-size control, sign-out. It takes
  the page's own path as `active`; the section is derived from that, so no page
  passes anything else. For a DOSEN account the header is minimal: no section
  nav, the logo links to Penilaian Saya, and a page outside the DOSEN allowlist
  redirects there (the proxy does the same first).
  On a phone the header must never push the page wider than the screen: the
  "Ukuran teks" label and the email hide below `sm` (the email stays in Keluar's
  tooltip), and the right-hand group is `min-w-0` so Keluar always fits. Checked at
  390px with a long university email.
- **Modals** — `fixed inset-0 z-50 flex items-center justify-center bg-black/40`,
  card is `border border-[var(--garis-kuat)] rounded-[var(--r-sedang)]`, no
  shadow. Field wrapper is a plain `<div>` (not `<label>`) whenever a field
  holds more than one control (a `<label>` may only wrap one labelable
  element — this was a real bug in the Penjadwalan form, fixed in phase 7).
- **Import panel** (`src/components/import/ImportPanel.tsx`) — one shared
  component for the three master-data import flows: download template →
  upload → dry-run diff (new/changed/unchanged/rejected, color-coded) →
  commit. Reused by Mata Kuliah, Dosen, Ruangan rather than rebuilt per page.
- **Empty states** — every list distinguishes "no data at all" from "no
  results for this search" (fixed a copy bug in phase 12 where both cases
  showed `No X match ""`). A page with zero rows and no search box (Sesi,
  Pengaturan, Rekap) still needs its own explicit empty message — Pengaturan
  was missing one entirely until phase 12.
- **Preview pages** (Cetak Jadwal, Rekap Dosen, Cetak Ujian, Rekap Pengawas,
  Cetak Sidang) — the preview is the data as app UI, not a picture of the file:
  server-rendered tables in the Bilah ledger style, with the Excel/Word
  download as the file. Nothing on screen is a PDF or docx render. The one
  exception is the "Unduh PDF" button on the three print pages
  (`DownloadButtons`, below): it fetches `…/cetak/pdf`, which converts the xlsx
  with Aspose Cells Cloud (150 calls/month free tier, shared by every
  document). Rekap Dosen (Word) and Rekap Pengawas (Excel) have no PDF. The
  downloaded file stays the source of truth for layout (page breaks, kop,
  one-page fit), which the preview does not prove. Every preview and its file
  are built from one pure row builder (`letter-rows.ts`, `exam-rows.ts`,
  `pengawas-rows.ts`, `defense-blocks.ts`) that a `check:*` script covers, so the
  two cannot drift.
  Shared pieces live in `src/components/preview.tsx`:
  - `PreviewLayout` — main column plus a `19rem` side panel (below it under
    `lg`); `1.3rem`/`1rem` page padding, `1.2rem` gap between sections.
  - `PreviewTable` + `BandRow` + `cell()` — bordered `--lembar` container
    (`--garis-kuat`, `--r-sedang`), `--cekung` header band with `0.73rem`
    uppercase `--tinta-3` labels, body cells `.27rem .53rem`, rows `2.6rem`
    (the Penjadwalan rhythm), `--garis` row dividers. `BandRow` is a
    full-width `--cekung` group row (KELAS A, Kelas Reguler).
  - `DocFacts` — the side panel: the settings-driven parts of the file that
    are not rows (zoom, keterangan, signer, kop, nomor, tembusan), as a
    `dl` with `0.73rem` uppercase labels and `0.87rem` values, plus an "Ubah
    di Pengaturan" link. Empty values show "—".
  - Section heading: `1.2rem`/600, `-0.01em` tracking, with a `0.87rem`
    `--tinta-3` meta line beside it. Sticky on Cetak, where several semesters
    stack.
  - Codes, times and SKS use `.mono`.
  - Cetak signature: the HARI cell shows once per run of rows in a kelas
    (repeats are `sr-only`), and a day change gets a stronger `--garis-kuat`
    divider, so the week reads down the table. Override rows tint
    `--merah-lembut`, the same meaning as Penjadwalan.
  - Rekap signature: the letter's TOTAL SKS is the focal number (`1.87rem`/600
    mono, the findings-bar size). `dosen=all` is an index table of dosen with
    jadwal count and SKS; picking a name opens that letter, with ‹ › steppers
    (`2.4rem` square targets) and "N dari M". Row text for the letter comes
    from `src/app/kuliah/rekap/letter-rows.ts`, shared with the docx builder so the
    preview and file cannot drift.
  - A preview shows the document's own wording, uppercase days and names
    included, because it has to match the file (see Language, below).
- **Select** (`src/components/Select.tsx`) — every `<select>` in the app was
  replaced with this, built on `@radix-ui/react-select`. Root cause: a
  native `<select>` popup is OS chrome (Safari repositions it to keep the
  selected option in view, so picking option 8 of 8 shows a truncated list
  instead of the full one from the top) — no CSS reaches into it. `Select`
  renders its own popup instead, skinned to the exact existing token/border
  styling, and mirrors each call site's `name`/`required`/`placeholder`/
  controlled-vs-uncontrolled semantics via Radix's hidden native-select form
  participation. Always reuse this for any new dropdown — never a raw
  `<select>` or a hand-rolled listbox.
- **Findings bar** (`src/components/FindingsBar.tsx`) — the standing, always-
  visible clash summary above every schedule (the "Direction and feel"
  principle above, made real): a big `1.87rem` red count when clashes exist, or
  a quiet green one-liner when clean. Generic: each schedule maps its own clash
  shape into `Finding<T>` (`policy`, a `where` label, `text`, `minutes`, and a
  `target` handed back to `onView`), plus optional `notes`, a separate `--kuning`
  box for gaps that are not clashes (an exam with no date, an offline exam with
  no room). Scoped to the whole academic year — `checkAllClashes()` for kuliah,
  `checkAllExamClashes()`, `checkAllDefenseClashes()` — not the semester or
  date filter, since a person or room clashing across two views still matters.
- **DownloadButtons** (`src/components/DownloadButtons.tsx`) — "Unduh PDF" +
  "Unduh Excel" at the right of a print page's context bar. The PDF is fetched,
  not navigated to: busy label "Membuat PDF…", inline `--merah-teks` error when
  Aspose fails, and the page stays put. Disabled when there is nothing to print.
- **PersonField** (`src/components/PersonField.tsx`) — a pengawas (or any person)
  is a dosen from the master, a fixed non-dosen name (AKADEMIK, from the
  `pengawas_cadangan` setting), or "Isi manual…" for free text. It is the
  existing `Select` plus a text input, not a new control.
- **Slot chips** — the quick-pick time windows in the ujian and sidang forms
  (`mono`, `.87rem`, `2.2rem` high, `--r-kecil`). Selected is the nav-active
  look (`--biru-lembut` fill, `--biru` border and text, `aria-pressed`), because
  selection is the one use of `--biru` besides action; the manual time inputs
  sit beside them.
- **Non-identity chips** — a dashed `--garis-kuat` pill means "free text, no
  record behind it" (a manually typed pengawas, "Non-dosen"); a solid pill means
  a fixed label (MKWU). Dashed was chosen over colour, which is reserved for
  status.

## Motion

`transition-colors`, `active:scale-[0.97]` or `[0.98]` on primary buttons.
Nothing longer than ~160ms. `prefers-reduced-motion` handled globally in
`globals.css`.

## Language

Interface copy is Indonesian, and `hariLabel()` (`src/lib/hari.ts`) gives
Indonesian title-case day names for the entry screens ("Senin"). The database
stores uppercase values (`SENIN`), and printed documents and their previews
show uppercase too, so a preview matches its file. Two rules follow:

- Never run `hariLabel()` before writing to the DB; store the uppercase value.
- Ujian and sidang store a `tanggal`, not a hari. The day is derived
  (`hariFromTanggal()`), and `tanggalPanjang()` writes the date line of the
  sidang sheets ("SELASA, 3 FEBRUARI 2026"). Dates are plain `YYYY-MM-DD` and
  are always handled in UTC so they cannot shift a day.

(An earlier version of this app showed English day names; `PLAN.md` §4 records
that history.)

## Kalender (week view)

`src/app/kuliah/kalender/` — a read-only Google-Calendar-style week grid (Senin–
Sabtu × time-of-day) for a kaprodi to review a semester at a glance. No
add/edit/delete anywhere on the page. Decisions held to this system rather
than inventing new ones for the new surface:

- **No new hue for kelas identity.** A calendar naturally wants categorical
  color per class, but "colour is scarce and only ever means status" (see
  Direction, above) is load-bearing here too — introducing 4-6 arbitrary
  hues to distinguish kelas would fragment the palette this system
  deliberately avoids. Kelas identity is a small mono badge + the course
  name instead; color stays reserved for status exactly as elsewhere:
  `--biru-lembut` for a normal block, `--merah-lembut`/`--merah-garis` for
  `is_override`, the same meaning as the Penjadwalan table's row tint.
- **Signature: overlap-as-layout.** Overlapping blocks split into side-by-
  side columns (`src/lib/calendar-layout.ts`, a pure greedy column-packing
  function, self-checked by `npm run check:calendar`) — this is the one
  element that could only exist for a *clash-detecting* scheduler: a dense
  cluster of narrow side-by-side blocks spatially IS a clash, visible
  without reading the findings-bar list.
- **Context bar** reuses the exact same three-`Select` filter
  (academic year / program / semester) and `.53rem/.33rem` rhythm as
  Penjadwalan/Cetak/Rekap's filter bars — same mental model, same pixels.
- Grid uses a `rem`-per-minute scale (`REM_PER_MIN = 0.055` in
  `KalenderClient.tsx`) rather than fixed `px`, so it rescales with the
  root text-size lever like everything else in the app.

### Dated calendars (Ujian, Sidang)

`/ujian/kalender` and `/sidang/kalender` are the same read-only week grid as
Kuliah's (`src/components/TimeGrid.tsx`, shared by all three, with
`DetailModal` for the click-through), but by real dates instead of hari:

- Columns are the days of one week (Senin–Sabtu, Minggu only when something falls
  on it), headed "Senin 27 Okt" with a count. Today gets the `--biru-lembut` column.
- **WeekNav** (`src/components/WeekNav.tsx`): ‹ › jump to the previous/next week
  *that has events* and a picker lists every such week with its count — exam
  week and defense days are a few weeks in a long year, so stepping one empty week
  at a time would be useless. Opens on this week or the next with events; the
  chosen week is kept in the URL (`minggu=`).
- Ujian: one card per mata kuliah's sitting (its kelas together), badge = kelas
  (with the semester as a bare roman numeral when "Semua semester" is shown),
  sub-line = rooms or the keterangan; colour per course, as on Kuliah's calendar.
  Undated exams aren't on the grid; a `--kuning` "N belum dijadwalkan" link in the
  context bar says so.
- Sidang: one card per mahasiswa, badge = room or `K1`, prasidang and sidang each
  keep one colour; both kinds show together by default because a dosen sits on
  both.
- Week arithmetic lives in `src/lib/week.ts` (UTC dates), covered by
  `check:calendar`.

### Kalender Gabungan (`/kalender`)

The faculty-wide sibling of the three dated calendars: one academic year's
**kuliah (both prodi) + UTS/UAS + prasidang/sidang** on the same
`TimeGrid`/`WeekNav`/`DetailModal` stack, reached from the menu hub's
"Lainnya" line and its own HeaderNav section (no tabs — it has no filters of
its own to tab between).

- **No filter stack.** The per-prodi/per-type kalenders are where filtering
  lives; the Gabungan view answers "what's on Monday 3 Nov across the whole
  faculty", so the context bar carries only a year `Select` + the term dates
  + `WeekNav`. Pushing prodi/jenis/semester selects here would rebuild the
  three kalenders inside one page.
- Kuliah meetings expand to real dates with the same term math as the public
  .ics feed (`kuliahDates` from `jadwal-dosen/events`) and **pause only in
  their own prodi+program's exam weeks** — S2 keeps meeting while S1
  reguler sits its UTS. Pure expansion lives in
  `src/app/kalender/items.ts`, self-checked by `check:kalender`.
- Type is carried by the badge, colour stays status-only + per-course:
  kuliah badge `3A` (`semester`+kelas), ujian `UTS · III · A`, sidang the
  jenis label with the mahasiswa's name; distinct `colorKey` prefixes
  (`K|`/`U|`/`S|`) keep one mata kuliah's kuliah and exam cards from
  sharing a hue — they are different events even when the colours rhyme.
- `is_override` tints red and shows the same ⚠/warning banner on all three
  kinds, same meaning as the Penjadwalan row tint.
- If the year's `mulai_kuliah`/`selesai_kuliah` are unset, kuliah silently
  has no dates — the page says so in `--kuning` rather than showing an
  inexplicably exam-only grid.
- The sidang detail modal keeps the materi link ("Lihat Materi ↗", new
  tab) that the public jadwal-dosen page shows; staff click it here too.

## Hari libur

Faculty-wide dates with no classes (`holidays` table, declared on the
Tahun Akademik page under the years card: list + inline add row + delete,
managed by the same `canManage` gate as the years). One date is either libur
or it isn't — the DB holds `tanggal UNIQUE` + a label.

- **One rule, every surface.** Kuliah meetings on a libur date are dropped
  everywhere the term math runs: the .ics feed (`exdates`, same array exam
  weeks ride in — a holiday pauses both prodi while an exam week pauses only
  its own program) and the Kalender Gabungan (`expandKuliah` skips it; the
  column header still says `libur: <label>` so the emptiness reads as "no
  classes on purpose", not a bug). Pure logic lives in
  `src/app/jadwal-dosen/events.ts` + `src/app/kalender/items.ts`, covered by
  `check:hari-libur` plus the feed/kalender suites.
- **Warn, never block.** Ujian and sidang can deliberately be held on a
  declared holiday — their form modals show a `--kuning` line under the
  Tanggal field ("Tercatat hari libur: <label> — tetap menyimpan bila memang
  diadakan"), threaded as a plain `libur` prop page → client → modal. The
  events themselves stay in feeds, boards and prints; only kuliah vanishes.
- On a repeating kuliah event the holiday appears as *absence with a name*: the
  feeds skip silently, but wherever a day column exists the label travels
  with it. Visibility lives on the marking surface, not on blocking.

## Menu hub and sections

`/` is a menu, not a dashboard. Same Bilah ledger, no card grid:

- **Campus band** — the same campus photo as the login page (the first photo from
  Pengaturan's login photos, or `public/images/fakultas-psikologi.jpg`), as a
  `9rem` band (`6.5rem` on a phone) above the year heading: `--r-sedang`, no
  border (a dark frame on a photo reads as harsh), cropped `object-[center_18%]`
  so the building's sign shows, a left-to-right `--tinta` gradient only for the
  caption's legibility, caption "UNIVERSITAS PANCASILA / Fakultas Psikologi" as on
  login. It sets the place; it is not a hero, never rotates, and the register
  stays the focus.

- **Register** — one `--lembar` container (`--garis-kuat`, `--r-sedang`), `62rem`
  wide, a row per schedule at least `5.2rem` tall, separated by `--garis`. From `md`
  up each row is one ledger line on a fixed grid (`1.6rem | 1fr | 18rem | 10.5rem |
  3rem`: folio · name · status · tally · Cetak) so the rows line up; on a phone the
  status and the tally + Cetak drop to their own lines under the name.
  - Folio `01`/`02`/`03` (`mono`, `--tinta-3`).
  - Name `1.2rem`/600 with a `›` (`--tinta-3`, nudges 2px and darkens on hover)
    kept on the same line as the last word; a `0.87rem` scope line under it. The
    name is a stretched link (`after:absolute after:inset-0`), so the whole row
    opens the schedule; Cetak sits above it (`relative z-10`) in `--tinta-2` —
    the secondary action never looks more clickable than the row.
  - Status is data, not a sentence: one lead figure in `--tinta`/600 (`97` jadwal,
    `3/68` UTS terjadwal, `Sab 3 Okt` berikutnya) and quieter facts in `--tinta-3`,
    sans, never `mono`. Each fact is `nowrap`; lines break between facts.
  - Hover and focus-within tint `--cekung`.
- **Tally** — the only colour on the page and the focal element: blocking
  clashes as a `1.87rem` red `mono` count with "BENTROK" under it; otherwise
  `--kuning` lines for warnings **and gaps** (rows that are not clashes but not
  done: undated exams, a defense missing an examiner); only then a `--hijau`
  "✓ bersih". A schedule with no rows gets "Belum ada jadwal" and no tally;
  a status that can't be read gets "Status belum bisa dibaca" — never a bare "—".
- **Admin links** — "Lainnya: Data Master · Manajemen Pengguna · Reset Jadwal ·
  Log Aktivitas" as a plain `--tinta-3` line under the register (the middle two are
  SUPERADMIN only): secondary to the three schedules, not a fourth row. Reset Jadwal
  is a button in the same link style; its hover is `--merah`, not `--tinta`.
- **Reset Jadwal modal** (`src/components/ResetJadwalButton.tsx`) — the one
  destructive bulk action. Step 1: tahun akademik `Select`, then a ledger grid of
  jadwal (Mata Kuliah & Dosen, UTS & UAS, Sidang & Seminar) × prodi, each cell a
  whole-cell checkbox label with its row count (`mono`); a ticked cell with rows
  tints `--merah-lembut` (red means "will be erased"), an empty cell is disabled.
  Focal number: the total to delete, `1.87rem` `--merah` `mono` (the findings-bar
  size). Step 2 is the danger pop-up: a `--merah-lembut` band ("TINDAKAN
  BERBAHAYA") on top of the modal, the list of what goes, and the year label typed
  to unlock a solid `--merah` "Hapus N jadwal". `reset_jadwal()` runs it as one
  transaction.
- **Section nav** — `HeaderNav` shows nothing on the menu; elsewhere it shows
  "‹ Menu", the section's name (`.93rem`/600) and that section's tabs (nav-active
  look for the current one). Sections: kuliah (Penjadwalan, Kalender, Cetak
  Jadwal, Rekap Dosen), ujian (Jadwal Ujian, Cetak, Rekap Pengawas), sidang
  (Jadwal Sidang, Cetak, and on S1 only Nilai Bimbingan), master (Mata Kuliah,
  Dosen, Ruangan, Sesi, Tahun Akademik, Pengaturan, and for Super Admin on S1
  Penilaian); Pengguna and Audit Log show just their title. Adding a
  page means adding its tab to that section's constant in `HeaderNav.tsx`, and a
  new schedule gets its row on the menu.
- **Roles** — VIEWER (Pemantau) reads, previews and downloads; SCHEDULER
  (Penjadwal) also edits the three schedules; only SUPERADMIN edits data master,
  Pengaturan and Pengguna. Entry screens get a `canEdit` prop that hides
  Tambah/Ubah/Isi/Import controls. The database (RLS) is the
  real enforcement; hiding is courtesy. Pengguna redirects non-SUPERADMIN.
  DOSEN (Dosen) and EKSTERNAL (Penguji Eksternal, a temporary day login) are not
  staff roles: they see only Penilaian Saya and their own grading pages, with a
  minimal header (see "Nilai Bimbingan" and "Nilai Sidang" below).
## Ujian (UTS/UAS)

`src/app/ujian/` — one row per mata kuliah × kelas (or kelas `GABUNGAN`), per
semester and program.

- **Signature: the MK block.** The table is a ledger whose mata-kuliah cells
  (tanggal, jam, kode, nama, SKS, keterangan) `rowSpan` down that course's kelas
  rows, exactly like the faculty's merged cells; a new date gets the stronger
  `--garis-kuat` rule so the days read down the page. Rows with no date sit under
  a "Belum dijadwalkan (N)" `BandRow`. An edit opens the whole block, not a row.
- **Edit modal** — the standard modal (`max-w-[40rem]`), one `fieldset` per kelas
  with its pengawas list (`PersonField` + "+ pengawas") and ruangan (shown only
  for Offline and Ujian Lisan). The clash check runs live (debounced) and again on
  save; a blocking clash asks for an override reason, as in Penjadwalan.
- **Clash model** — `findSlotClashes()` (`src/lib/clash.ts`) is the dated-slot
  counterpart to the weekly kuliah check; keys are people, rooms and kelas.
  Take Home and Project occupy nothing, Online occupies people but no room,
  AKADEMIK is a team and never clashes, and rows of one exam never clash with
  each other.
- **Print** — `/ujian/cetak`: one section per semester; MKWU exams on one slot
  fold into a single "UNIVERSITAS" cell (`bg-[var(--cekung)]`). **Rekap Pengawas**
  (`/ujian/rekap`): a band per person (name, "Dosen" or a dashed "Non-dosen" chip,
  `N tugas` in `mono`), the total tugas as the `1.87rem` focal number, and
  non-counted rows (Online, Take Home, Project) muted — only Offline and Ujian
  Lisan count.

## Prasidang & Sidang

`src/app/sidang/` — per mahasiswa, per day. NPM, nama, judul and the external
examiner are fields on the row (no mahasiswa master).

- **Signature: the day board.** One date as a grid, time slots as rows and rooms
  (sidang) or numbered kelompok (prasidang) as columns: `7.5rem` time column,
  `minmax(15rem, 1fr)` columns, cells at least `5rem`. Empty cells are open seats
  ("+ Isi"); a filled cell is a card (NPM `mono`, nama `.93rem`/500, judul clamped
  to two lines, examiners with their role labels). Severity paints the card —
  `--merah-lembut` for a blocking clash, `--kuning-lembut` for a warning — so a
  dosen booked twice in one slot is visible without reading the findings bar.
- **Date strip** — a button per date with its count, selected in the nav-active
  look; "Tambah tanggal" is a native date input. Searching NPM or nama jumps to the
  student's date and outlines the card (`--biru`, the selection colour).
- **Form** — the standard modal. Typing an NPM looks up the student's latest
  earlier defense in any year and fills the blank nama, judul and pembimbing
  ("Diisi dari prasidang 24 Nov 2025"). The external examiner is a text input with
  a native `datalist` of names typed before plus the dosen master.
- **Clash model** — dosen, external examiner and room or kelompok, prasidang and
  sidang together. A dosen teaching at the hour of a defense is always a warning
  (kuliah weeks may alternate, so it can't be proven).
- **Material link (`link`)** — a link to the prasidang/sidang **material** (Google Drive), typed in the standard sidang form modal ("Link Materi (opsional)") for both jenis, stored on the defense row (`chk_defenses_link` keeps it `''`-or-http(s) — the field renders as a `target=_blank` button on a public page, so `javascript:`/`data:`/scheme-less values are rejected in the form's `validate()` too). `normalizeDefenseLink()` + `defenseLinkLabel()` live in `defense-types.ts` (covered by `check:defense-link`): the label is "Lihat Materi" on drive/docs.google.com hosts, "Buka Tautan" elsewhere, with a `↗` and the Langganan-kalender primary look at row size (`text-[0.8rem]`, `--r-kecil`, `active:scale-[0.97]`). Display surface is the public `/jadwal-dosen` Sidang rows only — not the admin kalender modal, and not the Cetak sheet (a printed URL is dead paper). The `.ics` feed carries the link in the event's `description`, so a subscribed calendar offers it too.
- **Prasidang Zoom on the feed** — a prasidang sits in its program's breakout meeting, so the
  public Sidang row reads `Kelompok 1 · Zoom 8123456789 · Passcode p3l` (id + passcode straight
  from the program's `prasidang_zoom_*` settings, typed as-is), falling back to the old plain
  `Kelompok 1 (Zoom)` when those settings are empty. This is display data, not a join: the feed
  reads the two settings once per load and never blocks on them. The `.ics` `location` gets the
  same string.
- **Print** — `/sidang/cetak`: one section per date × room or kelompok, SESI
  numbered per block, only the slots in use. Prasidang carries the Zoom row and the
  "MENGETAHUI," line; sidang does not.

## Nilai Bimbingan (online grading)

S1 prasidang grading by the two dosen pembimbing. Pages: `/nilai-bimbingan/[defenseId]`, `/penilaian` (Penilaian Saya), `/[prodi]/sidang/nilai-bimbingan` (recap), `/[prodi]/pengaturan/penilaian` (rules). Same Bilah ledger; copy is Indonesian. Logic in `src/lib/penilaian/` (covered by `check:nilai-bimbingan`).

- **Grading form** (`NilaiForm.tsx`, `max-w-[52rem]`). Under the `1.6rem`/600 title, a facts `dl` (`12rem | 1fr`; labels `.73rem` uppercase `--tinta-3`): NPM (`mono`), nama, judul, IPK sebelum sidang (`—` when missing), tanggal, "Peran Anda". The form is a ledger `ol` (`--lembar`, `--garis-kuat`, `--r-sedang`, rows divided by `--garis`): per aspek, the label `.93rem`/500 with its bobot as a `mono` `.8rem` `--tinta-3` chip, the sub-points as a `.8rem` `--tinta-3` bullet list, and a `7rem` score input (`mono`, right-aligned, `inputMode="decimal"`, placeholder `0–100`, comma or dot). An invalid cell gets a `--merah` border and a `.8rem` `--merah-teks` message under it, shown only after the first submit attempt.
  - **Focal number**: the live total and letter ("80,00 · A"), `1.87rem` `mono`/600 with a "NILAI" caption, `aria-live="polite"`, `—` until every cell parses. The primary "Kirim nilai" button sits at the right of the same row.
  - **Confirm** is a native `<dialog>` (`showModal`, `backdrop:bg-black/40`, `26rem`), not the fixed-overlay modal: title, one sentence ("Setelah dikirim, nilai tidak bisa diubah."), the total and letter again, Batal and a primary button. The same dialog serves the Super Admin edit and old-grade entry with their own copy.
  - Errors come back as a `--merah-lembut` band under the form; success is a `--hijau` "Tersimpan." line. A "Nilai sudah dikirim." answer (graded in another tab) refreshes the page into the read-only view.
- **Submitted view** (`Terkirim`). A read-only `--lembar` table of the grade's own snapshot rows (Aspek, Bobot, Skor), "Dikirim <waktu>" in `--tinta-3` (plus "(input manual)"), and the focal nilai and letter. It reads the stored snapshot, never the current aspek list. Before the prasidang date the page shows a bordered notice "Penilaian dibuka pada <tanggal>." instead of a form. A dosen never sees the other dosen's grade.
- **Staff view of the same page.** One section per peran (`1.2rem`/600 heading, the dosen's name `.87rem` `--tinta-3`). Super Admin gets the prefilled form per submitted grade ("Simpan perubahan", confirm "Nilai sebelumnya diganti. Perubahan tercatat di Log Aktivitas."). An unsubmitted grade shows "Belum dinilai."; on a prasidang before the start date Super Admin also gets the explanatory line and a "Masukkan nilai lama" form ("Simpan nilai lama"). Penjadwal and Pemantau only read.
- **Penilaian Saya** (`/penilaian`, `62rem`). One `--lembar` register, rows divided by `--garis`, hover `--cekung`: date (`11rem`), then a stretched link with the NPM in `mono` and the nama over a one-line peran and judul, then a status pill: "Belum dibuka" (`--cekung`, `--tinta-3`, `--garis-kuat`), "Belum dinilai" (`--kuning-lembut`, `--kuning`, `--kuning-garis`), "Terkirim" (`--hijau-lembut`, `--hijau`). Newest first, all years. The empty state is one sentence in a bordered box ("Belum ada prasidang S1 yang Anda bimbing.").
- **Pengaturan Penilaian** (`max-w-[900px]`). Seven cards since Nilai Sidang (`Kartu`: `--lembar`, `--garis`, `--r-sedang`, `1.6rem` padding): aspek bimbingan, aspek sidang, pilihan yudisium, Tabel Nilai, predikat, SKS skripsi, tanggal mulai penilaian. Each has its own title (`1.07rem`/600), a `.87rem` `--tinta-3` help line over a `--garis` rule, its editor, then primary "Simpan", ghost "Kembalikan ke bawaan" and a status line. Every card saves alone.
  - Validation is live and inline: the first problem is worded with its row ("Baris 2, Bobot: …") in `--merah-teks` beside the buttons, and Simpan is disabled while there is one. "Tersimpan." (`--hijau`) shows only for the exact content that was saved; editing hides it.
  - Numbers are typed as text so a comma works (`2,75`) and are shown that way. Ordered rows carry ↑ ↓ × buttons with row-numbered `aria-label`s, and "+ Tambah …" under the list.
  - Aspek rows: name, bobot (`6rem`, `mono`), controls, and a sub-aspek textarea (one per line) spanning the row; a "Total bobot N dari 100" line under the list. Tabel Nilai and predikat are column grids with `.73rem` uppercase heads that scroll sideways on a phone (`min-w-[30rem]` / `38rem`); predikat has a "Wajib tepat waktu" checkbox per row.
- **Recap** (`/[prodi]/sidang/nilai-bimbingan`). A bar (`min-h-[3.2rem]`, `--lembar`, bottom `--garis`) with the tahun akademik `Select` and, right-aligned, the primary "Unduh Excel" (`--biru-disabled` and `cursor-not-allowed` with a title when there are no rows). Below, a `PreviewTable` "Rekap Nilai Bimbingan" with 13 columns (No, NPM, Nama, Judul, IPK, then Dosen/Nilai/Huruf for each dosen, then Nilai Bimbingan and Huruf). NPM and numbers are `mono`; numbers centered; the final nilai and letter `font-semibold`; a missing grade reads "belum dinilai" in `--tinta-3`; a manual one carries "(input manual)" in `.73rem` under its value. For Super Admin the nama and each nilai link to the grading page, and a missing grade on an old prasidang is a "Masukkan nilai lama" link. No prasidang in the year → `EmptySheet` "Belum ada prasidang" with a link to the board.
- **Beri Nilai** on the public `/jadwal-dosen` sidang rows: a secondary button next to the primary materi button, same size (`.8rem`, `--r-kecil`, `active:scale-[0.97]`) but outlined (`--garis-kuat`, `--tinta`, hover `--cekung`), "Beri Nilai ↗". Only S1 prasidang rows where the dosen is pembimbing or pembahas get it (sidang rows: see Nilai Sidang).
- **Master fields.** Mahasiswa: the list gains Email and a derived IPK column (`mono`, right, `—` when SKS or bobot is missing); the form gains Email, "SKS sebelum sidang" and "Bobot sebelum sidang" side by side (`mono`; bobot with a comma) and a "Lulus tepat waktu" checkbox. IPK is never an input. Dosen: Email and a "Dosen eksternal" checkbox.
- **Sidang form.** Dosen eksternal never appear in the Pembimbing Pendamping, Pembahas, Ketua Sidang or Anggota Penguji II selects (one already saved there stays listed), and a `--kuning` banner on the board names rows saved before the rule. A graded pembimbing's select is disabled with the hint "Sudah dinilai". The Reset Jadwal Sidang cell of a prodi with graded prasidang is disabled, with a `--merah-teks` line "N prasidang sudah dinilai: tidak bisa direset".
- **Pengguna.** Role "Dosen" replaces the Akses Prodi field with a Dosen picker (only non-eksternal lecturers without an account; helper line "Akses prodi: S1."). Changing an existing account to Dosen arms the same picker; nothing saves until a dosen is chosen. "Atur ulang kata sandi" on each row opens a small modal: a confirm sentence, then the new password in a `select-all` `<code>` box with a copy button and the line "Kata sandi ini tidak akan ditampilkan lagi. Bagikan ke pengguna secara langsung."

## Nilai Sidang (online grading of S1 sidang)

S1 sidang grading by Ketua Sidang, Anggota Penguji I and II, and the Ketua's lock. Pages: `/nilai-sidang/[defenseId]`, `/penilaian` (Penilaian Saya, shared with Nilai Bimbingan), `/[prodi]/sidang/nilai-akhir` (recap), `/[prodi]/sidang/akun-eksternal` (day logins), plus two more cards on `/[prodi]/pengaturan/penilaian`. Same Bilah ledger and the same grading-form pieces as Nilai Bimbingan (read that section first); copy is Indonesian. Logic in `src/lib/penilaian/` and `src/lib/mailer.ts` (covered by `check:nilai-sidang`).

- **Penguji form** (`PengujiForm.tsx`, page `max-w-[52rem]`, title "Nilai Sidang" `1.6rem`/600, the same facts `dl` with "Tanggal sidang" and "Peran Anda"). The aspek ledger, focal number and native `<dialog>` confirm are the Nilai Bimbingan ones; the dialog also lists "Revisi" (N baris or Tidak ada) and, on the Ketua's form, the yudisium. An examiner (DOSEN or EKSTERNAL) gets a `‹ Penilaian Saya` back link (`.87rem`, `--tinta-2`).
  - **Revisi** is its own `fieldset` under the ledger (`--lembar`, `--garis-kuat`, `--r-sedang`, `.9rem` padding): an "Ada revisi" checkbox. Ticked, it opens rows of a `7rem` Halaman input (optional) beside a two-line Catatan textarea (required; an empty one gets a `--merah` border and "Wajib diisi" after the first submit attempt) and a secondary "Hapus" with a row-numbered `aria-label`; "Tambah baris revisi" is a secondary button under the list. With no rows left, a `.8rem` `--merah-teks` line says to add one or untick.
  - **Yudisium** (Ketua only): an uppercase `.73rem` label over the shared `Select` (`min-w-[14rem]`, `--cekung`), placeholder "Pilih yudisium", `--merah` border and "Pilih yudisium" after a submit attempt. The submit button reads "Kirim nilai dan kunci".
- **Page states**, one per access result: a bordered `--lembar` notice for "Penilaian dibuka pada <tanggal>." and for the Ketua's "Menunggu Anggota Penguji I dan Anggota Penguji II." (or the legacy "Anggota Penguji I belum dipilih dari data dosen. Sidang belum dapat dikunci."); the form; the read-only `Terkirim` view; and after the lock the result strip below.
  - **Ketua panel.** Once both anggota have submitted: a `1.2rem`/600 section per anggota (the name `.87rem` `--tinta-3`, as in the staff view) with its read-only grade and revisi, then a "Nilai Anda" section holding the Ketua's form with the yudisium. The Ketua never sees a form before that, and no anggota ever sees another examiner's grade.
  - **Submitted view** is the Nilai Bimbingan one plus a "Revisi" `.93rem`/600 sub-heading: a `--lembar` table (Halaman `7rem`, `mono`, `—` when blank; Catatan, `whitespace-pre-line`) or "Tidak ada revisi." in `--tinta-3`. It reads the stored snapshot, never the current aspek list.
  - **Result strip** (locked): one bordered `--lembar` box, `--r-sedang`, items side by side with a `.73rem` uppercase `--tinta-3` caption each: Yudisium (`1.1rem`/600), Nilai Sidang (`mono`, `1.1rem`/600, "76,50 · A-", shown only to those who may read all three grades, so never to an anggota), Dikunci (`.93rem`, Jakarta time). After the lock everything is read-only for examiners.
- **Staff view of the same page.** One section per peran (as bimbingan), then a "Hasil sidang" section. Super Admin gets the prefilled form per submitted grade ("Simpan perubahan", confirm "Nilai dan revisi sebelumnya diganti. Email revisi tidak dikirim ulang. Perubahan tercatat di Log Aktivitas.") and, once locked, the result strip over a `YudisiumForm` (a `Select` and "Simpan yudisium", confirm "Ubah yudisium?"). On a sidang before the start date Super Admin gets "Masukkan nilai lama" per missing grade ("Simpan nilai lama"), and once all three exist a `YudisiumForm` "Kunci sidang" (confirm notes that no revisi email is sent for an old sidang). A grade entered that way carries "(input manual)". An unlocked sidang with no such rights reads "Belum dikunci." in `--tinta-3`. Penjadwal and Pemantau only read.
- **Penilaian Saya** gains sidang rows (the line under the nama reads "Sidang · Ketua Sidang · judul") and two pills: "Menunggu anggota" (`--cekung`, `--tinta-2`, `--garis-kuat`) for the Ketua before both anggota submit, and "Terkunci" (`--hijau-lembut`, `--hijau`, as "Terkirim"). A Ketua whose form is ready reads "Belum dinilai". An EKSTERNAL's page lists only its account day's sidang, with the intro line "Sidang S1 yang Anda uji pada <tanggal>."
- **Examiner header.** A DOSEN or EKSTERNAL gets the minimal header (no section nav, the logo links to Penilaian Saya). An EKSTERNAL has no "Ganti kata sandi" link: its password is set by the admin. The login form's field reads "Email atau username" (`type="text"`, no auto-capitalisation) with the help line "Alamat yang telah didaftarkan oleh administrator Anda. Penguji eksternal: username dari bagian akademik." An expired account answers "Akun ini sudah tidak berlaku." under the title "Akun tidak berlaku".
- **Account cards** (`/[prodi]/sidang/akun-eksternal`, `AkunClient.tsx`). A `.87rem` `--tinta-3` intro line (`max-w-[44rem]`: one account per dosen eksternal per sidang date, valid until the day after), then a grid of `--lembar` cards (`repeat(auto-fill, minmax(min(100%, 22rem), 1fr))`, `.8rem` gap, `--garis-kuat`, `--r-sedang`, `1rem` padding):
  - Head: the dosen's name (`1rem`/600) over the date (`.87rem`, `--tinta-2`), and a status pill at the right: "Aktif" (`--hijau-lembut`, `--hijau`) or "Kedaluwarsa" (`--cekung`, `--tinta-2`, `--garis`).
  - A `dl` (`.87rem`): Username (`mono`, `select-all`) and "Berlaku sampai" (long date), then "Mahasiswa hari itu": each student as `mono` time, nama and `mono` NPM in `--tinta-3`, or a `--tinta-3` sentence when none are left that day.
  - Footer on a `--garis` rule: outline "Buat password baru", and for Super Admin only a `Select` ("+1 hari" … "+7 hari") with an outline "Perpanjang" at the right; a refused action shows a `--merah-lembut` band above the footer.
  - **Password modal** is the Pengguna reset one (fixed overlay, `26rem`): a confirm sentence naming the dosen and username ("Kata sandi lama langsung tidak berlaku."), then the new password in a `select-all` `<code>` box with "Salin" (copies username and password) and "Tutup", and "Kata sandi ini tidak akan ditampilkan lagi. Serahkan langsung ke penguji."
  - No accounts → `EmptySheet` "Belum ada akun penguji eksternal" with a link to the sidang board.
- **Saving a sidang** whose eksternal Anggota Penguji I just got a day login swaps the modal for a dialog (`28rem`, as the password modal) titled "Akun penguji eksternal dibuat — catat dan serahkan": the dosen and date, Username and Kata sandi as `mono` `select-all` `<code>`, "Salin" and a primary "Tutup", and "Kata sandi ini tidak akan ditampilkan lagi. Bila hilang, buat yang baru di Akun Penguji Eksternal." If the login could not be made, the title is "Jadwal tersimpan" with the reason in a `--merah-lembut` band. A graded sidang's Ketua / Anggota selects are disabled with "Sudah dinilai", and so are its date and time controls.
- **Recap** (`/[prodi]/sidang/nilai-akhir`). The Nilai Bimbingan bar (`RekapBar`) with the primary "Unduh Excel", then a `PreviewTable` "Rekap Nilai Akhir" with 21 columns: No, NPM, Nama, Judul Skripsi, Nilai Bimbingan, Ketua / Nilai Ketua, Anggota I / Nilai I, Anggota II / Nilai II, Nilai Sidang, Huruf Sidang, Yudisium, Nilai Akhir, Huruf, Bobot Mutu, IPK Sebelum, IPK Setelah, Predikat, Status Email. Rules as in the bimbingan recap (`mono` numbers centred, a missing Nilai Bimbingan reads "belum dinilai" in `--tinta-3`, the nama links to the grading page). A sidang that is not final spans Nilai Akhir, Huruf and Bobot Mutu with one `--tinta-3` reason (`min-w-[14rem]`), and IPK Setelah and Predikat read `—`. Status Email reads Tidak perlu / Menunggu / Terkirim / Gagal / Sebagian; for Super Admin, where a retry is allowed, a small "Kirim ulang email" button (`.8rem`, `--cekung`, `--garis-kuat`, `active:scale-[0.97]`) sits under it with a `.73rem` `--merah-teks` error line. No sidang in the year → `EmptySheet` "Belum ada sidang skripsi" with a link to the board.
- **Pengaturan Penilaian** now has seven cards: Aspek bimbingan, Aspek sidang (the same card, new title and help line), Pilihan yudisium, Tabel Nilai, predikat, SKS skripsi, tanggal mulai. Pilihan yudisium rows are a grid `1fr | 6rem | auto`: the name, a "Lulus" checkbox, then ↑ ↓ ×; "+ Tambah pilihan" under the list; the help line says that editing the choices changes no locked sidang.
- **Beri Nilai** shows on every S1 sidang row of the public `/jadwal-dosen` page (all three examiner roles), same outlined button, "Beri Nilai ↗".
- **Pengguna** never offers "Penguji Eksternal" in the role pickers or filter chips. An EKSTERNAL row shows its role as plain `--tinta-3` text (no select) and "S1" for Akses Prodi.
- **Nav.** The S1 Jadwal Sidang section gains "Nilai Akhir" after "Nilai Bimbingan" and, for Super Admin and Penjadwal, "Akun Penguji Eksternal".

## Riwayat (per-record history)

`/log-aktivitas/riwayat?tabel=…&id=…` — one record's change trail (`src/app/log-aktivitas/riwayat/`, helpers in `src/lib/audit-history.ts`, covered by `check:audit-log`). Reached from the Log Aktivitas Detail modal ("Riwayat rekaman →"); the URL params are bookmarkable and validated (an unknown table or malformed id redirects to the log, never an error page). Fully server-rendered — no client JS; `HISTORY_LIMIT` 200 with a `--kuning` banner when a record has more.

- **Signature: the change-ladder.** A vertical rail (`w-px` `--garis`) with action-coloured dots (`10px`, `bg biru/hijau/merah`, punched out of the rail with a `2px` `--lembar` border; `--garis-kuat` for LOGOUT) per revision, entries newest first. Timeline of what happened to a ledger row — the history counterpart to the calendar's "overlap-as-layout".
- **Values read as words, never as keys.** Every diff value resolves through the `audit-history.ts` lookups (courses, lecturers, rooms — rooms fetched unfiltered: a retired room still has to carry its name). `kode_dosen` → "dr. Ani Widiastuti", a `pengawas` jsonb list → a comma list of names, `reguler`/`regsus` → the same `PROGRAM_LABEL` vocabulary as everywhere else, `SENIN` → "Senin" (title-case for display only — the uppercase DB values rule is untouched). An unknown id falls back to the raw value, never blank.
- **Old → new chips carry the diff.** UPDATE shows `--merah-lembut`/`--merah-teks` old → `→` `--hijau-lembut`/`--hijau` new (the app's status colours, reused as change semantics: red = what was, green = what is). INSERT renders its birth state as plain values (no tint — it is the record's state, not a delta); DELETE renders the old values tinted red. Missing values in a birth/death entry are omitted (`—`, `(kosong)`, `''`, and timestamps); an UPDATE with no real change says so in one quiet line.
- **Identity strip** — the record in a scheduler's words (`PSI-101 · Pengantar Psikologi` + context chips `Kelas A · Reguler · Semester 3 · 2025/2026`), built from the newest snapshot in the log itself, so deleted records still resolve. A trail ending in DELETE gets a `--merah-garis` "Dihapus" pill in the strip. Record id stays in the footer in `mono`, out of the reading path.

## Excel documents

Every Excel file is built with exceljs from the same pure row builder as its
preview. Shared helpers live in `src/lib/xlsx.ts` (`BORDER_ALL`, `estimateLines`,
`mergedText`, `setRowHeightForContent`): row heights are baked in because
converters clip wrapped text to the stored height. Style a cell first and merge
second (exceljs copies the master's style to the covered cells). Cell text is in
`sharedStrings.xml`, not the sheet XML, when a check script reads a file back.

## What's still design-debt

- The four master-data list tables use a different row height (36px) than
  the Bilah-mockup-derived tables (39px). Both are internally consistent;
  unifying them wasn't judged worth the diff during the phase-12 pass.
- No dark mode. Tokens are light-only; `prefers-color-scheme` isn't wired up.
- The sidang board scrolls sideways on narrow screens rather than reflowing, and
  opening an extra room or kelompok column (the "+" control) is local state that
  resets on reload until a defense is saved in it.
- The sidang and ujian entry screens were not checked in a browser at phone width.
- Database migrations are applied by hand in the Supabase SQL editor; a page
  whose table is missing renders empty (and the menu shows "—") rather than
  failing.
