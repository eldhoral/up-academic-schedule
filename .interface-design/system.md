# Course Scheduling — Design System ("Bilah")

Universitas Pancasila, S1 Psikologi. Internal admin tool, one role, dense
data-entry work. Source mockups: `desain/2b-bilah.html`, `desain/login.html`.
Full rationale in `PLAN.md` §4.

## Direction and feel

Findings bar over a full-width table, not a CRUD form with validation bolted
on — the app's value (catching clashes) stays visible at all times. Cool,
structural, technical: a registrar's ledger, not a SaaS dashboard. Colour is
scarce and only ever means status.

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

- **AppHeader** (`src/components/AppHeader.tsx`) — shared nav, text-size
  control, sign-out. Every page wraps it in `<div className="no-print">`
  on the two print routes.
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
- **Print pages** (Cetak Jadwal, Rekap Dosen) — `@page` size/orientation
  injected via a `<style>` tag built from the `ukuran_kertas`/`orientasi`
  settings; `.no-print` (in `globals.css`) hides chrome; `.rekap-break`
  (`page-break-before: always`) separates lecturers in "print all" mode.
  Print pages show Indonesian day names straight from the DB — never call
  `hariLabel()` here (see Language, below); this was a real bug (CetakClient
  and RekapClient both printed English) fixed by removing the call.
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
- **Findings bar** (`src/app/ClashFindingsBar.tsx`) — the standing, always-
  visible clash summary above the Penjadwalan table (the "Direction and
  feel" principle above, made real): a big `1.87rem` red count when clashes
  exist, or a quiet green one-liner when clean. Scoped to the whole academic
  year via `checkAllClashes()` (`app/clash-actions.ts`), not the
  semester/kelas filter, since a lecturer or room clashing across two
  different semesters still matters — only refetched when the year changes.

## Motion

`transition-colors`, `active:scale-[0.97]` or `[0.98]` on primary buttons.
Nothing longer than ~160ms. `prefers-reduced-motion` handled globally in
`globals.css`.

## Language

Admin UI shows English day names (`src/lib/hari.ts` — `hariLabel()`); the
database stores and every printed document shows Indonesian (`SENIN` etc.),
per PLAN.md §4. This is a real split, not a translation layer — never run
`hariLabel()` before writing to the DB or rendering a print page.

## Kalender (week view)

`src/app/kalender/` — a read-only Google-Calendar-style week grid (Senin–
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

## What's still design-debt

- The four master-data list tables use a different row height (36px) than
  the Bilah-mockup-derived tables (39px). Both are internally consistent;
  unifying them wasn't judged worth the diff during the phase-12 pass.
- No dark mode. Tokens are light-only; `prefers-color-scheme` isn't wired up.
