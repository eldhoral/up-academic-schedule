import { toMinutes } from '@/lib/clash'
import { layoutOverlapping } from '@/lib/calendar-layout'

// The week grid shared by the three calendars (kuliah by hari, ujian and sidang by date):
// columns are days, time runs down at REM_PER_MIN, overlapping events split side by side.

const REM_PER_MIN = 0.055

/** Deterministic pastel per key (a course, a jenis), so the same thing reads as the same
 *  color everywhere on the grid -- hue from a hash, fixed saturation/lightness so every
 *  card stays legible against the dark --tinta text. */
export function courseColor(key: string) {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  // Sequential course codes (10012001, 10012002, …) differ by 1 in the hash too —
  // multiplicative mixing spreads them around the hue circle instead of clumping.
  hash = Math.imul(hash, 2654435761) >>> 0
  const hue = hash % 360
  return {
    bg: `hsl(${hue} 65% 93%)`,
    border: `hsl(${hue} 45% 60%)`,
  }
}

export type GridEvent = {
  id: string
  jam_mulai: string
  jam_selesai: string
  title: string // full description, as a tooltip
  badge?: string // small pill after the time (kelas, ruang)
  name: string
  sub?: string
  colorKey: string
  danger?: boolean // an accepted clash override: red tint and a ⚠
  onClick: () => void
}

export type GridColumn = { key: string; label: string; sub: string; today: boolean; events: GridEvent[] }

export function TimeGrid({ columns, startHour, endHour }: { columns: GridColumn[]; startHour: number; endHour: number }) {
  let gridStartMin = startHour * 60
  let gridEndMin = endHour * 60
  for (const e of columns.flatMap((c) => c.events)) {
    gridStartMin = Math.min(gridStartMin, toMinutes(e.jam_mulai))
    gridEndMin = Math.max(gridEndMin, toMinutes(e.jam_selesai))
  }
  gridStartMin = Math.floor(gridStartMin / 60) * 60
  gridEndMin = Math.ceil(gridEndMin / 60) * 60

  const hourMarks: number[] = []
  for (let m = gridStartMin; m <= gridEndMin; m += 60) hourMarks.push(m)
  const height = `${(gridEndMin - gridStartMin) * REM_PER_MIN}rem`

  return (
    <div className="min-w-[54rem] border border-[var(--garis)] rounded-[var(--r-sedang)] bg-[var(--lembar)] overflow-hidden">
      {/* Day header row */}
      <div className="flex border-b border-[var(--garis-kuat)]">
        <div className="w-[3.6rem] shrink-0 bg-[var(--cekung)]" />
        {columns.map((c) => (
          <div
            key={c.key}
            className={`flex-1 px-[0.53rem] py-[0.53rem] text-center border-l border-[var(--garis)] ${c.today ? 'bg-[var(--biru-lembut)]' : 'bg-[var(--cekung)]'}`}
          >
            <div className={`text-[0.93rem] font-semibold ${c.today ? 'text-[var(--biru)]' : 'text-[var(--tinta-2)]'}`}>{c.label}</div>
            <div className="text-[0.8rem] text-[var(--tinta-3)]">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="flex relative">
        <div className="w-[3.6rem] shrink-0 relative bg-[var(--cekung)]">
          {hourMarks.map((m) => (
            <div
              key={m}
              className="absolute right-[0.4rem] -translate-y-1/2 text-[0.73rem] mono text-[var(--tinta-3)]"
              style={{ top: `${(m - gridStartMin) * REM_PER_MIN}rem` }}
            >
              {String(Math.floor(m / 60)).padStart(2, '0')}:00
            </div>
          ))}
          <div style={{ height }} />
        </div>

        {columns.map((c) => (
          <div key={c.key} className={`flex-1 relative border-l border-[var(--garis)] ${c.today ? 'bg-[var(--biru-lembut)]/20' : ''}`} style={{ height }}>
            {hourMarks.map((m) => (
              <div key={m} className="absolute left-0 right-0 border-t border-[var(--garis)]" style={{ top: `${(m - gridStartMin) * REM_PER_MIN}rem` }} />
            ))}

            {layoutOverlapping(c.events).map(({ event: e, col, cols }) => {
              const startMin = toMinutes(e.jam_mulai)
              const endMin = toMinutes(e.jam_selesai)
              const color = courseColor(e.colorKey)
              return (
                <button
                  key={e.id}
                  type="button"
                  title={e.title}
                  onClick={e.onClick}
                  className={`absolute overflow-hidden rounded-[var(--r-kecil)] border p-[0.2rem_0.33rem] text-left cursor-pointer transition-shadow hover:shadow-[0_0_0_2px_var(--biru)] ${
                    e.danger ? 'bg-[var(--merah-lembut)] border-[var(--merah-garis)]' : ''
                  }`}
                  style={{
                    top: `${(startMin - gridStartMin) * REM_PER_MIN}rem`,
                    height: `${Math.max(endMin - startMin, 20) * REM_PER_MIN}rem`,
                    left: `${(col / cols) * 100}%`,
                    width: `calc(${100 / cols}% - 0.13rem)`,
                    ...(e.danger ? {} : { backgroundColor: color.bg, borderColor: color.border }),
                  }}
                >
                  <div className="flex items-center gap-[0.27rem] leading-none mb-[0.13rem]">
                    <span className="text-[0.7rem] mono text-[var(--tinta-3)]">{e.jam_mulai.slice(0, 5)}</span>
                    {e.badge && (
                      <span className="inline-block px-[0.33rem] rounded-full text-[0.67rem] font-medium bg-[var(--lembar)] text-[var(--tinta-2)] border border-[var(--garis-kuat)] truncate">
                        {e.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-[0.8rem] font-medium text-[var(--tinta)] leading-[1.15] truncate">
                    {e.name}
                    {e.danger && <span className="ml-[0.27rem] text-[var(--merah)]">&#9888;</span>}
                  </div>
                  {e.sub && <div className="text-[0.7rem] text-[var(--tinta-3)] truncate">{e.sub}</div>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** The read-only card a calendar opens when an event is clicked. */
export function DetailModal({
  accent,
  title,
  meta,
  warning,
  rows,
  onClose,
}: {
  accent: string // a CSS color for the top stripe
  title: string
  meta: string
  warning?: { title: string; detail?: string }
  rows: [string, React.ReactNode][]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="w-full max-w-[28rem] bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="h-[0.33rem]" style={{ backgroundColor: accent }} />
        <div className="p-[1.4rem]">
          <div className="flex items-start justify-between gap-[0.8rem] mb-[0.2rem]">
            <h3 className="m-0 text-[1.07rem] font-semibold leading-[1.3]">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="shrink-0 text-[var(--tinta-3)] hover:text-[var(--tinta)] cursor-pointer bg-transparent border-0 p-0 text-[1.2rem] leading-none"
            >
              &times;
            </button>
          </div>
          <p className="mt-0 mb-[1.1rem] text-[0.8rem] mono text-[var(--tinta-3)]">{meta}</p>

          {warning && (
            <div className="mb-[1rem] bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.8rem] text-[var(--merah-teks)]">
              <b className="text-[var(--merah)]">&#9888; {warning.title}</b>
              {warning.detail && <span className="block mt-[0.13rem]">{warning.detail}</span>}
            </div>
          )}

          <dl className="space-y-[0.7rem] text-[0.93rem]">
            {rows.map(([label, value]) => (
              <div key={label} className="flex gap-[0.8rem]">
                <dt className="w-[7.5rem] shrink-0 text-[var(--tinta-3)]">{label}</dt>
                <dd className="m-0 flex-1">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex justify-end pt-[1.2rem]">
            <button
              type="button"
              onClick={onClose}
              className="px-[0.8rem] py-[0.4rem] rounded-[var(--r-kecil)] border border-[var(--garis-kuat)] text-[0.87rem] cursor-pointer hover:bg-[var(--cekung)]"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
