import type { Prodi } from '@/lib/prodi'
import type { Minggu } from '@/lib/clash'

/** Same term a year earlier, by the "YYYYT" id convention ("20261" = 2026/2027 Gasal): "20261" → "20251". */
export function previousYearId(id: string): string | null {
  const m = /^(\d{4})(\d)$/.exec(id)
  return m ? `${Number(m[1]) - 1}${m[2]}` : null
}

export type SourceSchedule = {
  prodi: Prodi
  jenis_kelas: string
  semester_ke: number
  kode_mk: string
  kelas: string
  hari: string
  jam_mulai: string
  jam_selesai: string
  room_id: string | null
  zoom_id: string
  minggu: Minggu
  keterangan: string
  schedule_lecturers: { kode_dosen: string; urutan: number }[]
}

type ClassKey = Pick<SourceSchedule, 'jenis_kelas' | 'semester_ke' | 'kode_mk' | 'kelas'>

// The columns of uq_schedules_class, minus the year.
const classKey = (r: ClassKey) => `${r.jenis_kelas}|${r.semester_ke}|${r.kode_mk}|${r.kelas}`

export const COPY_CONFLICT = 'academic_year_id,jenis_kelas,semester_ke,kode_mk,kelas'

/**
 * The slot carries over; enrolment and any clash override belong to the year they were made in. A room no
 * longer active is dropped: the form only offers active rooms, so an edit would clear it silently anyway.
 */
export function copiedSchedules(source: SourceSchedule[], academic_year_id: string, activeRoomIds: Set<string>) {
  return source.map((s) => ({
    academic_year_id,
    prodi: s.prodi,
    jenis_kelas: s.jenis_kelas,
    semester_ke: s.semester_ke,
    kode_mk: s.kode_mk,
    kelas: s.kelas,
    hari: s.hari,
    jam_mulai: s.jam_mulai,
    jam_selesai: s.jam_selesai,
    room_id: s.room_id && activeRoomIds.has(s.room_id) ? s.room_id : null,
    zoom_id: s.zoom_id,
    minggu: s.minggu,
    keterangan: s.keterangan,
    jumlah_mhs: 0,
    is_override: false,
    override_reason: '',
    override_by: null,
  }))
}

/** Dosen for the rows the upsert actually inserted; a class that already existed keeps its own. */
export function copiedLecturers(source: SourceSchedule[], inserted: (ClassKey & { id: string })[]) {
  const bySlot = new Map(source.map((s) => [classKey(s), s.schedule_lecturers]))
  return inserted.flatMap((row) =>
    (bySlot.get(classKey(row)) ?? []).map((sl) => ({ schedule_id: row.id, kode_dosen: sl.kode_dosen, urutan: sl.urutan }))
  )
}
