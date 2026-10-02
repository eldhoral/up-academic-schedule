import { HARI_DB } from '@/lib/hari'
import type { ScheduleRow } from '../penjadwalan-types'

// What a Surat Penugasan table says, shared by the docx builder and the on-screen preview.

export const TABLE_HEADER = ['NO.', 'MATA KULIAH', 'SKS', 'HARI', 'JAM', 'KELAS', 'RUANG', 'BOR ZOOM']

const hariIndex = (h: string) => (HARI_DB as readonly string[]).indexOf(h)

/** "PENGEMBANGAN DIRI DAN KARIER" -> "Pengembangan Diri Dan Karier", keeping roman numerals ("STATISTIKA II" -> "Statistika II"). */
export function titleCase(text: string): string {
  return text
    .split(/(\s+)/)
    .map((w) => (/^[IVXLC]+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('')
}

export function sortByHariJam(rows: ScheduleRow[]): ScheduleRow[] {
  return [...rows].sort((a, b) => hariIndex(a.hari) - hariIndex(b.hari) || a.jam_mulai.localeCompare(b.jam_mulai))
}

export const sumSks = (rows: ScheduleRow[]) => rows.reduce((sum, r) => sum + (r.courses?.sks ?? 0), 0)

export function rowTexts(r: ScheduleRow, i: number): string[] {
  return [
    `${i + 1}.`,
    titleCase(r.courses?.nama_mk ?? r.kode_mk),
    String(r.courses?.sks ?? ''),
    titleCase(r.hari),
    `${r.jam_mulai.slice(0, 5)}-${r.jam_selesai.slice(0, 5)}`.replace(/:/g, '.'),
    r.kelas,
    r.rooms?.nama ?? '',
    r.zoom_id || '',
  ]
}

export type LetterSection = { title: string; rows: string[][]; sks: number }

/** The sections a dosen teaches in; a dosen with no rows keeps an empty Reguler, like the docx. */
export function letterSections(rows: ScheduleRow[]): LetterSection[] {
  const section = (title: string, list: ScheduleRow[]): LetterSection => ({ title, rows: sortByHariJam(list).map(rowTexts), sks: sumSks(list) })
  const taught = [
    section('Kelas Reguler', rows.filter((s) => s.jenis_kelas === 'reguler')),
    section('Kelas Reguler Khusus', rows.filter((s) => s.jenis_kelas === 'regsus')),
  ].filter((sec) => sec.rows.length > 0)
  return taught.length > 0 ? taught : [section('Kelas Reguler', [])]
}
