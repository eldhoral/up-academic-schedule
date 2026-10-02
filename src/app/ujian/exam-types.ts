export const KETERANGAN_UJIAN = ['offline', 'online', 'take_home', 'project', 'ujian_lisan'] as const
export type KeteranganUjian = (typeof KETERANGAN_UJIAN)[number]

export const KETERANGAN_LABEL: Record<KeteranganUjian, string> = {
  offline: 'Offline',
  online: 'Online',
  take_home: 'Take Home',
  project: 'Project',
  ujian_lisan: 'Ujian Lisan',
}

/** Only a sit-down exam in a room needs a ruangan; online/take home/project have none. */
export const needsRoom = (k: KeteranganUjian) => k === 'offline' || k === 'ujian_lisan'

/** Pengawas: a dosen from the master, or free text (e.g. AKADEMIK). */
export type PengawasItem = { kode_dosen: string } | { nama: string }

export type ExamContext = {
  academic_year_id: string
  jenis_ujian: 'uts' | 'uas'
  jenis_kelas: 'reguler' | 'regsus'
  semester_ke: number
}

export type ExamRow = {
  id: string
  jenis_ujian: 'uts' | 'uas'
  jenis_kelas: 'reguler' | 'regsus'
  semester_ke: number
  kode_mk: string
  kelas: string // 'A'.. or 'GABUNGAN'
  tanggal: string | null
  jam_mulai: string | null
  jam_selesai: string | null
  room_id: string | null
  pengawas: PengawasItem[]
  keterangan_ujian: KeteranganUjian
  is_override: boolean
  override_reason: string
  courses: { nama_mk: string; sks: number } | null
  rooms: { nama: string } | null
}

/** An exam row plus what comes from the kuliah schedule. */
export type ExamView = ExamRow & {
  dosen: string[] // dosen pengampu display names, joined from schedules
  inKuliah: boolean // false once the kuliah row it was seeded from is gone
}

export const GABUNGAN = 'GABUNGAN'

/** "08:00-10:00,11:00-13:00" -> slots, skipping anything malformed. */
export function parseSesiList(text: string): { mulai: string; selesai: string }[] {
  return text
    .split(',')
    .map((s) => /^\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s*$/.exec(s))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ mulai: m[1].padStart(5, '0'), selesai: m[2].padStart(5, '0') }))
}

/** 'YYYY-MM-DD' -> 'dd/mm' for the ledger. */
export const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
