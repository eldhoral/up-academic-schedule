import { lecturerDisplayName } from '@/lib/import/tables'
import { HARI_DB } from '@/lib/hari'
import type { ScheduleRow } from '../penjadwalan-types'

const hariIndex = (h: string) => (HARI_DB as readonly string[]).indexOf(h)

export type PrintRow = {
  id: string
  kode_mk: string
  mata_kuliah: string
  sks: number | ''
  hari: string
  jam: string
  dosen: string
  ruangan: string
  zoom: string
}

/** Groups schedules by kelas (sorted A, B, C...), each group's rows sorted by weekday then start time. */
export function groupSchedulesByKelas(schedules: ScheduleRow[]): [string, PrintRow[]][] {
  const byKelas = new Map<string, ScheduleRow[]>()
  for (const s of schedules) {
    const list = byKelas.get(s.kelas) ?? []
    list.push(s)
    byKelas.set(s.kelas, list)
  }

  return Array.from(byKelas.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kelas, rows]) => [
      kelas,
      rows
        .sort((a, b) => hariIndex(a.hari) - hariIndex(b.hari) || a.jam_mulai.localeCompare(b.jam_mulai))
        .map((r) => {
          const suffix = r.minggu === 'ganjil' ? ' (A)' : r.minggu === 'genap' ? ' (B)' : ''
          const dosen =
            r.schedule_lecturers.length === 0
              ? 'MKWU'
              : r.schedule_lecturers
                  .sort((a, b) => a.urutan - b.urutan)
                  .map((sl) => (sl.lecturers ? lecturerDisplayName(sl.lecturers) : ''))
                  .join(', ')
          return {
            id: r.id,
            kode_mk: r.kode_mk,
            mata_kuliah: `${r.courses?.nama_mk ?? r.kode_mk}${suffix}`,
            sks: r.courses?.sks ?? '',
            hari: r.hari,
            jam: `${r.jam_mulai.slice(0, 5)} - ${r.jam_selesai.slice(0, 5)}`,
            dosen,
            ruangan: r.rooms?.nama ?? '',
            zoom: r.zoom_id || '',
          }
        }),
    ])
}
