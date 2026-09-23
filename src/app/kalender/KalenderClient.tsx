'use client'

import { useState } from 'react'
import { Select } from '@/components/Select'
import { toMinutes } from '@/lib/clash'
import { layoutOverlapping } from '@/lib/calendar-layout'
import { lecturerDisplayName } from '@/lib/import/tables'
import { HARI_DB as HARI, hariLabel } from '@/lib/hari'
import type { AcademicYear, ScheduleRow } from '../penjadwalan-types'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]
const REM_PER_MIN = 0.055
const DEFAULT_START_HOUR = 7
const DEFAULT_END_HOUR = 21

/** Deterministic pastel per mata kuliah, so the same course reads as the same
 *  color everywhere on the grid — hue from a hash, fixed saturation/lightness
 *  so every course stays legible against the dark --tinta text used on cards. */
function courseColor(kodeMk: string) {
  let hash = 0
  for (let i = 0; i < kodeMk.length; i++) hash = (hash * 31 + kodeMk.charCodeAt(i)) >>> 0
  // Sequential course codes (10012001, 10012002, …) differ by 1 in the hash too —
  // multiplicative mixing spreads them around the hue circle instead of clumping.
  hash = Math.imul(hash, 2654435761) >>> 0
  const hue = hash % 360
  return {
    bg: `hsl(${hue} 65% 93%)`,
    border: `hsl(${hue} 45% 60%)`,
  }
}

// Sunday getDay()=0 has no column in this six-day academic week.
const TODAY_HARI_INDEX: Record<number, number> = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 }

export function KalenderClient({
  academicYears,
  schedules: initialSchedules,
  context: initialContext,
}: {
  academicYears: AcademicYear[]
  schedules: ScheduleRow[]
  context: { academic_year_id: string; jenis_kelas: 'reguler' | 'regsus'; semester_ke: number }
}) {
  const [schedules, setSchedules] = useState(initialSchedules)
  const [context, setContext] = useState(initialContext)
  const [selected, setSelected] = useState<ScheduleRow | null>(null)

  const [prevInitial, setPrevInitial] = useState({ schedules: initialSchedules, context: initialContext })
  if (initialSchedules !== prevInitial.schedules || initialContext !== prevInitial.context) {
    setPrevInitial({ schedules: initialSchedules, context: initialContext })
    setSchedules(initialSchedules)
    setContext(initialContext)
  }

  async function navigate(next: Partial<typeof context>) {
    const merged = { ...context, ...next }
    const params = new URLSearchParams({
      ay: merged.academic_year_id,
      jenis: merged.jenis_kelas,
      smt: String(merged.semester_ke),
    })
    setContext(merged)
    window.history.replaceState(null, '', `/kalender?${params.toString()}`)
    const res = await fetch(`/api/schedules?${params.toString()}`)
    setSchedules(await res.json())
  }

  const todayIndex = TODAY_HARI_INDEX[new Date().getDay()]

  let gridStartMin = DEFAULT_START_HOUR * 60
  let gridEndMin = DEFAULT_END_HOUR * 60
  for (const s of schedules) {
    gridStartMin = Math.min(gridStartMin, toMinutes(s.jam_mulai))
    gridEndMin = Math.max(gridEndMin, toMinutes(s.jam_selesai))
  }
  gridStartMin = Math.floor(gridStartMin / 60) * 60
  gridEndMin = Math.ceil(gridEndMin / 60) * 60

  const hourMarks: number[] = []
  for (let m = gridStartMin; m <= gridEndMin; m += 60) hourMarks.push(m)

  const byHari = HARI.map((h) => ({
    hari: h,
    rows: layoutOverlapping(schedules.filter((s) => s.hari === h)),
  }))

  return (
    <div className="flex-1 flex flex-col">
      <div className="min-h-[3.2rem] flex items-center gap-[0.53rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
        <label className="text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-ay">
          Tahun akademik
        </label>
        <Select
          id="ctx-ay"
          value={context.academic_year_id}
          onValueChange={(v) => navigate({ academic_year_id: v })}
          options={academicYears.map((ay) => ({ value: ay.id, label: ay.label }))}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-jenis">
          Program
        </label>
        <Select
          id="ctx-jenis"
          value={context.jenis_kelas}
          onValueChange={(v) => navigate({ jenis_kelas: v as 'reguler' | 'regsus' })}
          options={[
            { value: 'reguler', label: 'Reguler' },
            { value: 'regsus', label: 'Reguler Khusus' },
          ]}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-smt">
          Semester
        </label>
        <Select
          id="ctx-smt"
          value={String(context.semester_ke)}
          onValueChange={(v) => navigate({ semester_ke: parseInt(v, 10) })}
          options={SEMESTERS.map((s) => ({ value: String(s), label: String(s) }))}
          className="bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]"
        />

        <span className="ml-auto text-[0.87rem] text-[var(--tinta-3)]">
          {schedules.length} kelas minggu ini &middot; hanya lihat
        </span>
      </div>

      <div className="flex-1 overflow-auto p-[1.3rem]">
        <div className="min-w-[54rem] border border-[var(--garis)] rounded-[var(--r-sedang)] bg-[var(--lembar)] overflow-hidden">
          {/* Day header row */}
          <div className="flex border-b border-[var(--garis-kuat)]">
            <div className="w-[3.6rem] shrink-0 bg-[var(--cekung)]" />
            {byHari.map(({ hari, rows }, i) => (
              <div
                key={hari}
                className={`flex-1 px-[0.53rem] py-[0.53rem] text-center border-l border-[var(--garis)] ${
                  i === todayIndex ? 'bg-[var(--biru-lembut)]' : 'bg-[var(--cekung)]'
                }`}
              >
                <div
                  className={`text-[0.93rem] font-semibold ${i === todayIndex ? 'text-[var(--biru)]' : 'text-[var(--tinta-2)]'}`}
                >
                  {hariLabel(hari)}
                </div>
                <div className="text-[0.8rem] text-[var(--tinta-3)]">{rows.length} kelas</div>
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
              <div style={{ height: `${(gridEndMin - gridStartMin) * REM_PER_MIN}rem` }} />
            </div>

            {byHari.map(({ hari, rows }, i) => (
              <div
                key={hari}
                className={`flex-1 relative border-l border-[var(--garis)] ${i === todayIndex ? 'bg-[var(--biru-lembut)]/20' : ''}`}
                style={{ height: `${(gridEndMin - gridStartMin) * REM_PER_MIN}rem` }}
              >
                {hourMarks.map((m) => (
                  <div
                    key={m}
                    className="absolute left-0 right-0 border-t border-[var(--garis)]"
                    style={{ top: `${(m - gridStartMin) * REM_PER_MIN}rem` }}
                  />
                ))}

                {rows.map(({ event: r, col, cols }) => {
                  const startMin = toMinutes(r.jam_mulai)
                  const endMin = toMinutes(r.jam_selesai)
                  const dosen =
                    r.schedule_lecturers.length === 0
                      ? 'MKWU'
                      : r.schedule_lecturers
                          .sort((a, b) => a.urutan - b.urutan)
                          .map((sl) => (sl.lecturers ? lecturerDisplayName(sl.lecturers) : '—'))
                          .join(', ')
                  const title = `${r.courses?.nama_mk ?? r.kode_mk} — Kelas ${r.kelas} — ${r.jam_mulai.slice(0, 5)}–${r.jam_selesai.slice(0, 5)} — ${dosen}${r.rooms ? ` — ${r.rooms.nama}` : ''}`
                  const color = courseColor(r.kode_mk)

                  return (
                    <button
                      key={r.id}
                      type="button"
                      title={title}
                      onClick={() => setSelected(r)}
                      className={`absolute overflow-hidden rounded-[var(--r-kecil)] border p-[0.2rem_0.33rem] text-left cursor-pointer transition-shadow hover:shadow-[0_0_0_2px_var(--biru)] ${
                        r.is_override ? 'bg-[var(--merah-lembut)] border-[var(--merah-garis)]' : ''
                      }`}
                      style={{
                        top: `${(startMin - gridStartMin) * REM_PER_MIN}rem`,
                        height: `${Math.max(endMin - startMin, 20) * REM_PER_MIN}rem`,
                        left: `${(col / cols) * 100}%`,
                        width: `calc(${100 / cols}% - 0.13rem)`,
                        ...(r.is_override ? {} : { backgroundColor: color.bg, borderColor: color.border }),
                      }}
                    >
                      <div className="flex items-center gap-[0.27rem] leading-none mb-[0.13rem]">
                        <span className="text-[0.7rem] mono text-[var(--tinta-3)]">{r.jam_mulai.slice(0, 5)}</span>
                        <span className="inline-block px-[0.33rem] rounded-full text-[0.67rem] font-medium bg-[var(--lembar)] text-[var(--tinta-2)] border border-[var(--garis-kuat)]">
                          {r.kelas}
                        </span>
                      </div>
                      <div className="text-[0.8rem] font-medium text-[var(--tinta)] leading-[1.15] truncate">
                        {r.courses?.nama_mk ?? r.kode_mk}
                        {r.is_override && <span className="ml-[0.27rem] text-[var(--merah)]">&#9888;</span>}
                      </div>
                      <div className="text-[0.7rem] text-[var(--tinta-3)] truncate">{r.rooms?.nama ?? dosen}</div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selected && <ScheduleDetailModal schedule={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function ScheduleDetailModal({ schedule: r, onClose }: { schedule: ScheduleRow; onClose: () => void }) {
  const color = courseColor(r.kode_mk)
  const dosen =
    r.schedule_lecturers.length === 0
      ? [{ label: 'MKWU' }]
      : r.schedule_lecturers
          .sort((a, b) => a.urutan - b.urutan)
          .map((sl) => ({ label: sl.lecturers ? lecturerDisplayName(sl.lecturers) : '—' }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[26rem] bg-[var(--lembar)] border border-[var(--garis-kuat)] rounded-[var(--r-sedang)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-[0.33rem]" style={{ backgroundColor: r.is_override ? 'var(--merah)' : color.border }} />
        <div className="p-[1.4rem]">
          <div className="flex items-start justify-between gap-[0.8rem] mb-[0.2rem]">
            <h3 className="m-0 text-[1.07rem] font-semibold leading-[1.3]">{r.courses?.nama_mk ?? r.kode_mk}</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="shrink-0 text-[var(--tinta-3)] hover:text-[var(--tinta)] cursor-pointer bg-transparent border-0 p-0 text-[1.2rem] leading-none"
            >
              &times;
            </button>
          </div>
          <p className="mt-0 mb-[1.1rem] text-[0.8rem] mono text-[var(--tinta-3)]">
            {r.kode_mk} &middot; Kelas {r.kelas} &middot; {r.courses?.sks ?? '—'} SKS
          </p>

          {r.is_override && (
            <div className="mb-[1rem] bg-[var(--merah-lembut)] border border-[var(--merah-garis)] rounded-[var(--r-kecil)] p-[0.6rem] text-[0.8rem] text-[var(--merah-teks)]">
              <b className="text-[var(--merah)]">&#9888; Jadwal ini menerobos aturan bentrok.</b>
              {r.override_reason && <span className="block mt-[0.13rem]">{r.override_reason}</span>}
            </div>
          )}

          <dl className="space-y-[0.7rem] text-[0.93rem]">
            <DetailRow label="Hari & jam">
              {hariLabel(r.hari)}, {r.jam_mulai.slice(0, 5)}–{r.jam_selesai.slice(0, 5)}
              {r.minggu !== 'setiap' && ` (minggu ${r.minggu})`}
            </DetailRow>
            <DetailRow label="Dosen">{dosen.map((d) => d.label).join(', ')}</DetailRow>
            <DetailRow label="Ruangan">{r.rooms?.nama || '—'}</DetailRow>
            <DetailRow label="Zoom">{r.zoom_id || '—'}</DetailRow>
            <DetailRow label="Jumlah mahasiswa">{r.jumlah_mhs}</DetailRow>
            {r.keterangan && <DetailRow label="Keterangan">{r.keterangan}</DetailRow>}
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

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-[0.8rem]">
      <dt className="w-[7.5rem] shrink-0 text-[var(--tinta-3)]">{label}</dt>
      <dd className="m-0 flex-1">{children}</dd>
    </div>
  )
}
