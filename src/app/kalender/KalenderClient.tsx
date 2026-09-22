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
          Academic year
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
          {schedules.length} class{schedules.length === 1 ? '' : 'es'} this week &middot; view only
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
                <div className="text-[0.8rem] text-[var(--tinta-3)]">
                  {rows.length} class{rows.length === 1 ? '' : 'es'}
                </div>
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

                  return (
                    <div
                      key={r.id}
                      title={title}
                      className={`absolute overflow-hidden rounded-[var(--r-kecil)] border p-[0.2rem_0.33rem] cursor-default ${
                        r.is_override
                          ? 'bg-[var(--merah-lembut)] border-[var(--merah-garis)]'
                          : 'bg-[var(--biru-lembut)] border-[var(--biru)]/25'
                      }`}
                      style={{
                        top: `${(startMin - gridStartMin) * REM_PER_MIN}rem`,
                        height: `${Math.max(endMin - startMin, 20) * REM_PER_MIN}rem`,
                        left: `${(col / cols) * 100}%`,
                        width: `calc(${100 / cols}% - 0.13rem)`,
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
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
