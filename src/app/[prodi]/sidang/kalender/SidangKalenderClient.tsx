'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import { DetailModal, TimeGrid, courseColor, type GridColumn } from '@/components/TimeGrid'
import { WeekNav } from '@/components/WeekNav'
import { hariFromTanggal, tanggalPanjang } from '@/lib/hari'
import { dayLabel, defaultWeek, eventWeeks, mondayOf, weekDays } from '@/lib/week'
import { jenisLabel, type DefenseRow } from '../defense-types'
import type { AcademicYear } from '../../kuliah/penjadwalan-types'
import { useProdi } from '@/lib/use-prodi'
import { PRODI_CONFIG } from '@/lib/prodi'

const CONTROL = 'bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]'

type Context = { academic_year_id: string; jenis: 'prasidang' | 'sidang' | 'all' }

const place = (d: DefenseRow) => (d.jenis === 'sidang' ? `Ruang ${d.room_nama ?? '—'}` : `Kelompok ${d.kelompok ?? '—'}`)

export function SidangKalenderClient({
  academicYears,
  context,
  defenses,
  names,
  initialWeek,
}: {
  academicYears: AcademicYear[]
  context: Context
  defenses: DefenseRow[]
  names: Record<string, string>
  initialWeek: string | null
}) {
  const prodi = useProdi()
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const weeks = useMemo(() => eventWeeks(defenses.map((d) => d.tanggal)), [defenses])
  const [week, setWeek] = useState(initialWeek ? mondayOf(initialWeek) : defaultWeek(defenses.map((d) => d.tanggal), today))
  const [selected, setSelected] = useState<DefenseRow | null>(null)
  const name = (kode: string | null) => (kode ? (names[kode] ?? kode) : '—')

  const queryOf = (c: Context, minggu?: string) => new URLSearchParams({ ay: c.academic_year_id, jenis: c.jenis, ...(minggu ? { minggu } : {}) })

  function pickWeek(monday: string) {
    setWeek(monday)
    window.history.replaceState(null, '', `/${prodi}/sidang/kalender?${queryOf(context, monday)}`)
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const d of defenses) c[mondayOf(d.tanggal)] = (c[mondayOf(d.tanggal)] ?? 0) + 1
    return c
  }, [defenses])

  const days = weekDays(week, defenses.some((d) => mondayOf(d.tanggal) === week && hariFromTanggal(d.tanggal) === 'MINGGU'))
  const columns: GridColumn[] = days.map((day) => {
    const list = defenses.filter((d) => d.tanggal === day)
    return {
      key: day,
      label: dayLabel(day),
      sub: `${list.length} mahasiswa`,
      today: day === today,
      events: list.map((d) => ({
        id: d.id,
        jam_mulai: d.jam_mulai,
        jam_selesai: d.jam_selesai,
        title: `${d.nama_mahasiswa} (${d.npm}) — ${jenisLabel(prodi, d.jenis)} — ${d.jam_mulai}–${d.jam_selesai} — ${place(d)}`,
        badge: d.jenis === 'sidang' ? d.room_nama ?? '—' : `K${d.kelompok ?? ''}`,
        name: d.nama_mahasiswa,
        sub: `${jenisLabel(prodi, d.jenis)} · ${d.npm}`,
        // Prasidang and sidang each keep one colour, so the two kinds read apart at a glance.
        colorKey: d.jenis,
        danger: d.is_override,
        onClick: () => setSelected(d),
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
          onValueChange={(v) => router.push(`/${prodi}/sidang/kalender?${queryOf({ ...context, academic_year_id: v })}`)}
          options={academicYears.map((ay) => ({ value: ay.id, label: ay.label }))}
          className={CONTROL}
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-jenis">
          Jenis
        </label>
        <Select
          id="ctx-jenis"
          value={context.jenis}
          onValueChange={(v) => router.push(`/${prodi}/sidang/kalender?${queryOf({ ...context, jenis: v as Context['jenis'] })}`)}
          options={[
            { value: 'all', label: PRODI_CONFIG[prodi].defense.section },
            { value: 'prasidang', label: jenisLabel(prodi, 'prasidang') },
            { value: 'sidang', label: jenisLabel(prodi, 'sidang') },
          ]}
          className={CONTROL}
        />

        <div className="ml-auto flex items-center gap-[0.8rem] flex-wrap">
          <span className="text-[0.87rem] text-[var(--tinta-3)]">hanya lihat</span>
          <WeekNav weeks={weeks} current={week} counts={counts} onChange={pickWeek} />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-[1.3rem]">
        {defenses.length === 0 && <p className="m-0 mb-[1rem] text-[0.93rem] text-[var(--tinta-3)]">Belum ada jadwal prasidang atau sidang di tahun akademik ini.</p>}
        <TimeGrid columns={columns} startHour={8} endHour={17} />
      </div>

      {selected && (
        <DetailModal
          accent={selected.is_override ? 'var(--merah)' : courseColor(selected.jenis).border}
          title={selected.nama_mahasiswa}
          meta={`${selected.npm} · ${jenisLabel(prodi, selected.jenis)}`}
          warning={selected.is_override ? { title: 'Jadwal ini menerobos aturan bentrok.' } : undefined}
          rows={[
            ['Hari & jam', `${tanggalPanjang(selected.tanggal, false)}, ${selected.jam_mulai}–${selected.jam_selesai}`],
            [selected.jenis === 'sidang' ? 'Ruang' : 'Kelompok', selected.jenis === 'sidang' ? (selected.room_nama ?? '—') : String(selected.kelompok ?? '—')],
            [PRODI_CONFIG[prodi].defense.judul, selected.judul_skripsi || '—'],
            ...(selected.jenis === 'sidang'
              ? ([
                  ['Ketua sidang', name(selected.penguji_kode)],
                  ['Penguji I (eksternal)', selected.penguji_eksternal || '—'],
                  ['Penguji II (pembimbing)', name(selected.pembimbing_kode)],
                ] as [string, React.ReactNode][])
              : ([
                  ['Pembimbing pendamping', name(selected.pembimbing_kode)],
                  ['Pembahas', name(selected.penguji_kode)],
                ] as [string, React.ReactNode][])),
          ]}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
