'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/Select'
import { DetailModal, TimeGrid, courseColor, type GridColumn } from '@/components/TimeGrid'
import { WeekNav } from '@/components/WeekNav'
import { hariFromTanggal, hariLabel } from '@/lib/hari'
import { romanSemester } from '@/lib/print'
import { dayLabel, defaultWeek, eventWeeks, mondayOf, weekDays } from '@/lib/week'
import { GABUNGAN, KETERANGAN_LABEL, needsRoom, shortDate, type ExamView } from '../exam-types'
import type { AcademicYear } from '../../kuliah/penjadwalan-types'
import { useProdi } from '@/lib/use-prodi'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8]
const CONTROL = 'bg-[var(--cekung)] border border-[var(--garis-kuat)] rounded-[var(--r-kecil)] px-[0.53rem] py-[0.33rem] text-[0.93rem] min-h-[2.4rem]'
const UJIAN_LABEL = { uts: 'UTS', uas: 'UAS' }

type Context = { academic_year_id: string; jenis_ujian: 'uts' | 'uas'; jenis_kelas: 'reguler' | 'regsus'; semester_ke: number | 'all' }

/** One exam on the grid: a mata kuliah's kelas that sit together (same semester, same slot). */
type Block = { key: string; rows: ExamView[] }

export function UjianKalenderClient({
  academicYears,
  context,
  exams,
  names,
  initialWeek,
}: {
  academicYears: AcademicYear[]
  context: Context
  exams: ExamView[]
  names: Record<string, string>
  initialWeek: string | null
}) {
  const prodi = useProdi()
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const dated = useMemo(() => exams.filter((e) => e.tanggal && e.jam_mulai && e.jam_selesai), [exams])
  const weeks = useMemo(() => eventWeeks(dated.map((e) => e.tanggal!)), [dated])
  const [week, setWeek] = useState(initialWeek ? mondayOf(initialWeek) : defaultWeek(dated.map((e) => e.tanggal!), today))
  const [selected, setSelected] = useState<Block | null>(null)

  const queryOf = (c: Context, minggu?: string) =>
    new URLSearchParams({ ay: c.academic_year_id, ujian: c.jenis_ujian, jenis: c.jenis_kelas, smt: String(c.semester_ke), ...(minggu ? { minggu } : {}) })

  function navigate(next: Partial<Context>) {
    router.push(`/${prodi}/ujian/kalender?${queryOf({ ...context, ...next })}`)
  }

  function pickWeek(monday: string) {
    setWeek(monday)
    window.history.replaceState(null, '', `/${prodi}/ujian/kalender?${queryOf(context, monday)}`)
  }

  const blocks = useMemo(() => {
    const m = new Map<string, Block>()
    for (const e of dated) {
      const key = `${e.semester_ke}|${e.kode_mk}|${e.tanggal}|${e.jam_mulai}`
      const b = m.get(key) ?? { key, rows: [] }
      b.rows.push(e)
      m.set(key, b)
    }
    return [...m.values()].map((b) => ({ ...b, rows: [...b.rows].sort((x, y) => x.kelas.localeCompare(y.kelas)) }))
  }, [dated])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const b of blocks) c[mondayOf(b.rows[0].tanggal!)] = (c[mondayOf(b.rows[0].tanggal!)] ?? 0) + 1
    return c
  }, [blocks])

  const allSemesters = context.semester_ke === 'all'
  const days = weekDays(week, blocks.some((b) => hariFromTanggal(b.rows[0].tanggal!) === 'MINGGU' && mondayOf(b.rows[0].tanggal!) === week))
  const columns: GridColumn[] = days.map((d) => {
    const dayBlocks = blocks.filter((b) => b.rows[0].tanggal === d)
    return {
      key: d,
      label: dayLabel(d),
      sub: `${dayBlocks.length} ujian`,
      today: d === today,
      events: dayBlocks.map((b) => {
        const h = b.rows[0]
        const nama = h.courses?.nama_mk ?? h.kode_mk
        const kelas = b.rows.map((r) => r.kelas).join(', ')
        const rooms = [...new Set(b.rows.map((r) => (needsRoom(r.keterangan_ujian) ? r.rooms?.nama : null)).filter(Boolean))].join(', ')
        const ket = keteranganOf(b.rows)
        return {
          id: b.key,
          jam_mulai: h.jam_mulai!,
          jam_selesai: h.jam_selesai!,
          title: `${nama} — Kelas ${kelas} — ${h.jam_mulai!.slice(0, 5)}–${h.jam_selesai!.slice(0, 5)} — ${ket}${rooms ? ` — ${rooms}` : ''}`,
          // Semester as a bare roman numeral: the column is narrow when exams share a slot.
          badge: allSemesters ? `${romanSemester(h.semester_ke)} · ${kelas}` : kelas,
          name: nama,
          sub: rooms || ket,
          colorKey: h.kode_mk,
          danger: b.rows.some((r) => r.is_override),
          onClick: () => setSelected(b),
        }
      }),
    }
  })

  const undated = exams.length - dated.length
  const pengawas = (r: ExamView) => r.pengawas.map((p) => ('kode_dosen' in p ? (names[p.kode_dosen] ?? p.kode_dosen) : p.nama)).join(', ') || '—'

  return (
    <div className="flex-1 flex flex-col">
      <div className="min-h-[3.2rem] flex items-center gap-[0.53rem] px-[1.3rem] py-[0.4rem] bg-[var(--lembar)] border-b border-[var(--garis)] flex-wrap">
        <label className="text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-ay">
          Tahun akademik
        </label>
        <Select id="ctx-ay" value={context.academic_year_id} onValueChange={(v) => navigate({ academic_year_id: v })} options={academicYears.map((ay) => ({ value: ay.id, label: ay.label }))} className={CONTROL} />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-ujian">
          Ujian
        </label>
        <Select
          id="ctx-ujian"
          value={context.jenis_ujian}
          onValueChange={(v) => navigate({ jenis_ujian: v as 'uts' | 'uas' })}
          options={[
            { value: 'uts', label: 'UTS' },
            { value: 'uas', label: 'UAS' },
          ]}
          className={CONTROL}
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
          className={CONTROL}
        />

        <label className="ml-[0.53rem] text-[0.8rem] text-[var(--tinta-3)]" htmlFor="ctx-smt">
          Semester
        </label>
        <Select
          id="ctx-smt"
          value={String(context.semester_ke)}
          onValueChange={(v) => navigate({ semester_ke: v === 'all' ? 'all' : parseInt(v, 10) })}
          options={[{ value: 'all', label: 'Semua semester' }, ...SEMESTERS.map((s) => ({ value: String(s), label: String(s) }))]}
          className={CONTROL}
        />

        <div className="ml-auto flex items-center gap-[0.8rem] flex-wrap">
          {undated > 0 && (
            <Link href={`/${prodi}/ujian?${new URLSearchParams({ ay: context.academic_year_id, ujian: context.jenis_ujian, jenis: context.jenis_kelas, ...(allSemesters ? {} : { smt: String(context.semester_ke) }) })}`} className="text-[0.87rem] text-[var(--kuning)]">
              {undated} belum dijadwalkan
            </Link>
          )}
          <span className="text-[0.87rem] text-[var(--tinta-3)]">hanya lihat</span>
          <WeekNav weeks={weeks} current={week} counts={counts} onChange={pickWeek} />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-[1.3rem]">
        {blocks.length === 0 && (
          <p className="m-0 mb-[1rem] text-[0.93rem] text-[var(--tinta-3)]">
            Belum ada {UJIAN_LABEL[context.jenis_ujian]} yang diberi tanggal{exams.length > 0 ? '; atur tanggalnya di Jadwal Ujian' : ''}.
          </p>
        )}
        <TimeGrid columns={columns} startHour={8} endHour={17} />
      </div>

      {selected && (
        <DetailModal
          accent={selected.rows.some((r) => r.is_override) ? 'var(--merah)' : courseColor(selected.rows[0].kode_mk).border}
          title={selected.rows[0].courses?.nama_mk ?? selected.rows[0].kode_mk}
          meta={`${selected.rows[0].kode_mk} · Semester ${selected.rows[0].semester_ke} · ${selected.rows[0].courses?.sks ?? '—'} SKS · ${UJIAN_LABEL[context.jenis_ujian]}`}
          warning={
            selected.rows.some((r) => r.is_override)
              ? { title: 'Ujian ini menerobos aturan bentrok.', detail: selected.rows.find((r) => r.override_reason)?.override_reason || undefined }
              : undefined
          }
          rows={[
            ['Hari & jam', `${hariLabel(hariFromTanggal(selected.rows[0].tanggal!))} ${shortDate(selected.rows[0].tanggal!)}, ${selected.rows[0].jam_mulai!.slice(0, 5)}–${selected.rows[0].jam_selesai!.slice(0, 5)}`],
            ['Keterangan', keteranganOf(selected.rows)],
            ['Dosen pengampu', [...new Set(selected.rows.flatMap((r) => r.dosen))].join(', ') || (selected.rows[0].inKuliah ? 'MKWU' : '—')],
            ...selected.rows.map(
              (r): [string, React.ReactNode] => [
                r.kelas === GABUNGAN ? 'Kelas GABUNGAN' : `Kelas ${r.kelas}`,
                <>
                  {pengawas(r)}
                  {needsRoom(r.keterangan_ujian) && <span className="text-[var(--tinta-3)]"> · {r.rooms?.nama ?? 'tanpa ruangan'}</span>}
                </>,
              ],
            ),
          ]}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

/** Each kelas has its own keterangan; a block shows the distinct ones. */
const keteranganOf = (rows: ExamView[]) => [...new Set(rows.map((r) => KETERANGAN_LABEL[r.keterangan_ujian]))].join(', ')
