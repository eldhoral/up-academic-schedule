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
  passes anything else.
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

## Menu hub and sections

`/` is a menu, not a dashboard. Same Bilah ledger, no card grid:

- **Register** — one `--lembar` container (`--garis-kuat`, `--r-sedang`) with a
  row per schedule, each at least `5.2rem` tall, separated by `--garis`:
  folio (`01`/`02`/`03`, `mono`, `--tinta-3`) · name (`1.2rem`/600, `-0.01em`)
  with a `0.87rem` scope line · live status for the active tahun akademik
  (`mono`, `.93rem`) · the clash **tally** · "Cetak" link. The whole row is the
  link (a stretched `after:absolute after:inset-0`; the status and Cetak links
  sit above it with `relative z-10`). Hover and focus-within tint `--cekung`.
- **Tally** — the only colour on the page and the focal element: blocking
  clashes as a `1.87rem` red `mono` count with "BENTROK" under it; otherwise
  warnings as a `--kuning` line; otherwise a quiet `--hijau` "✓ bersih". If a
  status can't be read (table not created yet) the cell shows "—", never an
  error page.
- **Admin strip** — Data Master, Manajemen Pengguna (SUPERADMIN only) and
  Audit Log as one `--cekung` row of plain links at `2.6rem`: visibly secondary
  to the three schedules.
- **Section nav** — `HeaderNav` shows nothing on the menu; elsewhere it shows
  "‹ Menu", the section's name (`.93rem`/600) and that section's tabs (nav-active
  look for the current one). Sections: kuliah (Penjadwalan, Kalender, Cetak
  Jadwal, Rekap Dosen), ujian (Jadwal Ujian, Cetak, Rekap Pengawas), sidang
  (Jadwal Sidang, Cetak), master (Mata Kuliah, Dosen, Ruangan, Sesi, Tahun
  Akademik, Pengaturan); Pengguna and Audit Log show just their title. Adding a
  page means adding its tab to that section's constant in `HeaderNav.tsx`, and a
  new schedule gets its row on the menu.
- **Roles** — VIEWER (Pemantau) reads, previews and downloads; entry screens get
  a `canEdit` prop that hides Tambah/Ubah/Isi controls. The database (RLS) is the
  real enforcement; hiding is courtesy. Pengguna redirects non-SUPERADMIN.

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
- **Print** — `/sidang/cetak`: one section per date × room or kelompok, SESI
  numbered per block, only the slots in use. Prasidang carries the Zoom row and the
  "MENGETAHUI," line; sidang does not.

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
