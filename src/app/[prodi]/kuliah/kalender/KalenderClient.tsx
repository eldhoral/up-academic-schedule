'use client'

import { useState } from 'react'
import { Select } from '@/components/Select'
import { DetailModal, TimeGrid, courseColor } from '@/components/TimeGrid'
import { lecturerDisplayName } from '@/lib/import/tables'
import { HARI_DB as HARI, hariLabel } from '@/lib/hari'
import type { AcademicYear, ScheduleRow } from '../penjadwalan-types'
import { useProdi } from '@/lib/use-prodi'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]
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
  const prodi = useProdi()
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
    window.history.replaceState(null, '', `/${prodi}/kuliah/kalender?${params.toString()}`)
    const res = await fetch(`/api/schedules?${params.toString()}`)
    setSchedules(await res.json())
  }

  const todayIndex = TODAY_HARI_INDEX[new Date().getDay()]

  const dosenOf = (r: ScheduleRow) =>
    r.schedule_lecturers.length === 0
      ? 'MKWU'
      : [...r.schedule_lecturers]
          .sort((a, b) => a.urutan - b.urutan)
          .map((sl) => (sl.lecturers ? lecturerDisplayName(sl.lecturers) : '—'))
          .join(', ')

  const columns = HARI.map((hari, i) => {
    const rows = schedules.filter((s) => s.hari === hari)
    return {
      key: hari,
      label: hariLabel(hari),
      sub: `${rows.length} kelas`,
      today: i === todayIndex,
      events: rows.map((r) => ({
        id: r.id,
        jam_mulai: r.jam_mulai,
        jam_selesai: r.jam_selesai,
        title: `${r.courses?.nama_mk ?? r.kode_mk} — Kelas ${r.kelas} — ${r.jam_mulai.slice(0, 5)}–${r.jam_selesai.slice(0, 5)} — ${dosenOf(r)}${r.rooms ? ` — ${r.rooms.nama}` : ''}`,
        badge: r.kelas,
        name: r.courses?.nama_mk ?? r.kode_mk,
        sub: r.rooms?.nama ?? dosenOf(r),
        colorKey: r.kode_mk,
        danger: r.is_override,
        onClick: () => setSelected(r),
      })),
    }
  })

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

        {/* ponytail: same workbook as Cetak Jadwal's "Unduh Excel" -- same filters, same route */}
        <a
          href={`/${prodi}/kuliah/cetak/xlsx?${new URLSearchParams({
            ay: context.academic_year_id,
            jenis: context.jenis_kelas,
            smt: String(context.semester_ke),
          }).toString()}`}
          className="inline-flex items-center px-[1rem] py-[0.4rem] min-h-[2.5rem] rounded-[var(--r-kecil)] bg-[var(--biru)] text-white font-medium cursor-pointer hover:bg-[var(--biru-hover)] active:scale-[0.97] transition-colors text-[0.93rem]"
        >
          Unduh Excel
        </a>
      </div>

      <div className="flex-1 overflow-auto p-[1.3rem]">
        <TimeGrid columns={columns} startHour={DEFAULT_START_HOUR} endHour={DEFAULT_END_HOUR} />
      </div>

      {selected && <ScheduleDetailModal schedule={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function ScheduleDetailModal({ schedule: r, onClose }: { schedule: ScheduleRow; onClose: () => void }) {
  const dosen =
    r.schedule_lecturers.length === 0
      ? 'MKWU'
      : [...r.schedule_lecturers]
          .sort((a, b) => a.urutan - b.urutan)
          .map((sl) => (sl.lecturers ? lecturerDisplayName(sl.lecturers) : '—'))
          .join(', ')

  return (
    <DetailModal
      accent={r.is_override ? 'var(--merah)' : courseColor(r.kode_mk).border}
      title={r.courses?.nama_mk ?? r.kode_mk}
      meta={`${r.kode_mk} · Kelas ${r.kelas} · ${r.courses?.sks ?? '—'} SKS`}
      warning={r.is_override ? { title: 'Jadwal ini menerobos aturan bentrok.', detail: r.override_reason || undefined } : undefined}
      rows={[
        ['Hari & jam', `${hariLabel(r.hari)}, ${r.jam_mulai.slice(0, 5)}–${r.jam_selesai.slice(0, 5)}${r.minggu !== 'setiap' ? ` (minggu ${r.minggu})` : ''}`],
        ['Dosen', dosen],
        ['Ruangan Luring', r.rooms?.nama || '—'],
        ['Ruangan Daring', r.zoom_id || '—'],
        ['Jumlah mahasiswa', r.jumlah_mhs],
        ...(r.keterangan ? ([['Keterangan', r.keterangan]] as [string, React.ReactNode][]) : []),
      ]}
      onClose={onClose}
    />
  )
}
