import { findSlotClashes } from '@/lib/clash'
import type { Prodi } from '@/lib/prodi'
import { needsRoom, GABUNGAN, type KeteranganUjian, type PengawasItem } from './exam-types'

export type ExamClashInput = {
  id: string
  prodi: Prodi
  kode_mk: string
  nama_mk: string
  jenis_ujian: string
  jenis_kelas: string
  semester_ke: number
  kelas: string
  tanggal: string | null
  jam_mulai: string | null
  jam_selesai: string | null
  room_id: string | null
  pengawas: PengawasItem[]
  keterangan_ujian: KeteranganUjian
}

export type ExamClashType = 'pengawas' | 'ruangan' | 'kelas'

export type ExamClash = {
  type: ExamClashType
  a: ExamClashInput
  b: ExamClashInput
  overlapMinutes: number
  detail: string
}

export const normalizeName = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase()

/** kelas letters per "prodi/jenis_kelas/semester" -- what a GABUNGAN row is taken to cover. */
export type KelasMap = Map<string, string[]>

/**
 * What a row occupies while it is sat. Take home and project occupy nothing; online
 * occupies people but no room; a pengawas from `cadangan` (AKADEMIK) is a team, not a person.
 */
export function examKeys(row: ExamClashInput, kelasMap: KelasMap, cadangan: Set<string>): string[] {
  if (row.keterangan_ujian === 'take_home' || row.keterangan_ujian === 'project') return []

  const keys: string[] = []
  for (const p of row.pengawas) {
    if ('kode_dosen' in p) keys.push(`dosen:${p.kode_dosen}`)
    else if (!cadangan.has(normalizeName(p.nama))) keys.push(`nama:${normalizeName(p.nama)}`)
  }
  if (needsRoom(row.keterangan_ujian) && row.room_id) keys.push(`ruang:${row.room_id}`)

  // Kelas keys carry the prodi: kelas A of S1 and kelas A of S2 are different students.
  const scope = `${row.prodi}/${row.jenis_kelas}/${row.semester_ke}`
  const kelas = row.kelas === GABUNGAN ? (kelasMap.get(scope) ?? []) : [row.kelas]
  for (const k of kelas) keys.push(`kelas:${scope}/${k}`)
  return keys
}

/**
 * Clashes among exam rows that are on a date. `names` turns a dosen code into a display name and
 * `roomNames` a room id into its name, for the detail text. Rows of the same exam (same mata kuliah,
 * several kelas) share a room and proctors on purpose, so they never clash with each other.
 */
export function findExamClashes(
  rows: ExamClashInput[],
  kelasMap: KelasMap,
  cadangan: Set<string>,
  names: Map<string, string>,
  roomNames: Map<string, string>,
): ExamClash[] {
  const slots = rows.map((r) => ({ ...r, keys: examKeys(r, kelasMap, cadangan) }))
  const sameExam = (a: ExamClashInput, b: ExamClashInput) =>
    a.prodi === b.prodi && a.kode_mk === b.kode_mk && a.jenis_ujian === b.jenis_ujian && a.jenis_kelas === b.jenis_kelas && a.semester_ke === b.semester_ke

  return findSlotClashes(slots)
    .filter(({ a, b }) => !sameExam(a, b))
    .map(({ a, b, key, overlapMinutes }) => {
      const [prefix, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
      if (prefix === 'ruang') return { type: 'ruangan' as const, a, b, overlapMinutes, detail: roomNames.get(id) ?? '' }
      if (prefix === 'kelas') {
        const [, , smt, kelas] = id.split('/')
        return { type: 'kelas' as const, a, b, overlapMinutes, detail: `Kelas ${kelas} (smt ${smt})` }
      }
      return { type: 'pengawas' as const, a, b, overlapMinutes, detail: prefix === 'dosen' ? (names.get(id) ?? id) : id }
    })
}
