import type { Course } from './mata-kuliah/MataKuliahClient'
import type { Lecturer } from './dosen/DosenClient'
import type { Room } from './ruangan/RuanganClient'
import type { SessionRow } from './sesi/SesiClient'

export type AcademicYear = { id: string; label: string; is_active: boolean }

export type ScheduleRow = {
  id: string
  academic_year_id: string
  jenis_kelas: 'reguler' | 'regsus'
  semester_ke: number
  kode_mk: string
  kelas: string
  hari: string
  jam_mulai: string
  jam_selesai: string
  room_id: string | null
  zoom_id: string
  jumlah_mhs: number
  minggu: 'setiap' | 'ganjil' | 'genap'
  keterangan: string
  is_override: boolean
  override_reason: string
  courses: { nama_mk: string; sks: number } | null
  rooms: { nama: string } | null
  schedule_lecturers: {
    urutan: number
    lecturers: { kode_dosen: string; nama: string; gelar_depan: string; gelar_belakang: string } | null
  }[]
}

export type { Course, Lecturer, Room, SessionRow }
