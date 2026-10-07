import { PRODI_CONFIG, type Prodi } from '@/lib/prodi'
import type { DefenseJenis, DefenseRow } from './defense-types'

// What a printed prasidang/sidang sheet says, shared by the on-screen preview and the Excel
// builder so the two cannot drift. Pure: dosen names are looked up in `names`.

export type ColumnSpec = {
  header: string // as printed in Excel (line breaks as in the faculty template)
  label: string // the same on screen
  width: number // Excel character-width units, from the faculty's templates
  center?: boolean
}

export const DEFENSE_COLUMNS: Record<DefenseJenis, ColumnSpec[]> = {
  sidang: [
    { header: 'SESI', label: 'SESI', width: 6.6, center: true },
    { header: 'WAKTU', label: 'WAKTU', width: 13.6, center: true },
    { header: 'NPM', label: 'NPM', width: 14.3 },
    { header: 'NAMA', label: 'NAMA', width: 21.4 },
    { header: 'JUDUL SKRIPSI', label: 'JUDUL SKRIPSI', width: 45.1 },
    { header: 'KETUA SIDANG', label: 'KETUA SIDANG', width: 25 },
    { header: 'ANGGOTA PENGUJI I\n(Penguji Eksternal)', label: 'ANGGOTA PENGUJI I (Penguji Eksternal)', width: 25 },
    { header: 'ANGGOTA PENGUJI II\n(Dosen Pembimbing)', label: 'ANGGOTA PENGUJI II (Dosen Pembimbing)', width: 28.7 },
  ],
  prasidang: [
    { header: 'SESI', label: 'SESI', width: 6, center: true },
    { header: 'WAKTU', label: 'WAKTU', width: 16.3, center: true },
    { header: 'NPM', label: 'NPM', width: 12.9 },
    { header: 'NAMA', label: 'NAMA', width: 21.9 },
    { header: 'JUDUL SKRIPSI', label: 'JUDUL SKRIPSI', width: 41.7 },
    { header: 'DOSEN PEMBIMBING PENDAMPING', label: 'DOSEN PEMBIMBING PENDAMPING', width: 30.7 },
    { header: 'DOSEN PEMBAHAS', label: 'DOSEN PEMBAHAS', width: 30.7 },
  ],
}

/** The columns for one prodi: the templates are S1's, only the judul header changes ("JUDUL TESIS" for S2). */
export const defenseColumns = (prodi: Prodi, jenis: DefenseJenis): ColumnSpec[] =>
  DEFENSE_COLUMNS[jenis].map((c) => {
    if (c.header !== 'JUDUL SKRIPSI') return c
    const judul = PRODI_CONFIG[prodi].defense.judul.toUpperCase()
    return { ...c, header: judul, label: judul }
  })

export type BlockRow = { cells: string[] } // one string per column, SESI first

export type DefenseBlock = {
  key: string
  tanggal: string // 'YYYY-MM-DD'
  ruang: string // sidang: the room's name, else ''
  kelompok: number | null // prasidang
  rows: BlockRow[]
}

const jam = (mulai: string, selesai: string) => `${mulai.replace(':', '.')}-${selesai.replace(':', '.')}`

/**
 * One block (one printed sheet) per date and room (sidang) or kelompok (prasidang), in date order
 * then room name / kelompok number. Rows run in time order and SESI is numbered within the block.
 * Only the slots actually in use print.
 */
export function buildDefenseBlocks(rows: DefenseRow[], names: Map<string, string>): DefenseBlock[] {
  const name = (kode: string | null) => (kode ? (names.get(kode) ?? kode) : '')
  const groups = new Map<string, DefenseRow[]>()
  for (const r of rows) {
    const key = `${r.tanggal}|${r.jenis === 'sidang' ? (r.room_nama ?? '') : String(r.kelompok ?? 0).padStart(4, '0')}`
    groups.set(key, [...(groups.get(key) ?? []), r])
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'id', { numeric: true }))
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai) || a.npm.localeCompare(b.npm))
      const head = sorted[0]
      return {
        key,
        tanggal: head.tanggal,
        ruang: head.jenis === 'sidang' ? (head.room_nama ?? '') : '',
        kelompok: head.kelompok,
        rows: sorted.map((r, i) => ({
          cells: [
            String(i + 1),
            jam(r.jam_mulai, r.jam_selesai),
            r.npm,
            r.nama_mahasiswa,
            r.judul_skripsi,
            ...(r.jenis === 'sidang'
              ? [name(r.penguji_kode), r.penguji_eksternal, name(r.pembimbing_kode)] // Ketua, Penguji I, Penguji II
              : [name(r.pembimbing_kode), name(r.penguji_kode)]), // Pembimbing Pendamping, Pembahas
          ],
        })),
      }
    })
}

/** An Excel sheet name for a block: "03-02 R301" / "24-11 K1". At most 31 characters, none of []:*?/\. */
export function sheetName(block: DefenseBlock, jenis: DefenseJenis, taken: Set<string>): string {
  const day = `${block.tanggal.slice(8, 10)}-${block.tanggal.slice(5, 7)}`
  const place = jenis === 'sidang' ? `R${block.ruang}` : `K${block.kelompok ?? ''}`
  const base = `${day} ${place}`.replace(/[[\]:*?/\\]/g, '').trim().slice(0, 28)
  let name = base
  for (let n = 2; taken.has(name); n++) name = `${base} ${n}`
  taken.add(name)
  return name
}
