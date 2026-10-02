import { hariFromTanggal, hariLabel } from '@/lib/hari'
import { KETERANGAN_LABEL, type KeteranganUjian } from './exam-types'

// What a printed UTS/UAS sheet says, shared by the on-screen preview and the Excel
// builder so the two cannot drift. Pure: names are already resolved by the caller.

export const EXAM_COLUMNS = ['KODE MK', 'MATA KULIAH', 'SKS', 'HARI', 'TANGGAL', 'JAM', 'DOSEN PENGAMPU', 'KELAS', 'PENGAWAS', 'RUANGAN', 'KETERANGAN']
export const EXAM_ALIGN: ('left' | 'center')[] = ['center', 'left', 'center', 'center', 'center', 'center', 'left', 'center', 'left', 'center', 'center']
// Excel character-width units, from the faculty's ETS template.
export const EXAM_WIDTHS = [11.6, 30, 5.4, 10.4, 12.3, 12.7, 28, 13, 32, 11.6, 15.3]

const COL = { hari: 3, tanggal: 4, jam: 5, dosen: 6, keterangan: 10 }

export type PrintExam = {
  kode_mk: string
  nama_mk: string
  sks: number | null
  kelas: string
  tanggal: string | null // 'YYYY-MM-DD'
  jam_mulai: string | null // 'HH:MM'
  jam_selesai: string | null
  dosen: string[]
  pengawas: string[] // display names, free text as typed
  ruangan: string // '' when the exam has no room
  keterangan: KeteranganUjian
  mkwu: boolean // taught by no dosen: run by the university, printed as "UNIVERSITAS"
}

/** A table cell; null = covered by a merge that started above or to the left. */
export type TableCell = { text: string; rowSpan: number; colSpan: number } | null
export type TableRow = { cells: TableCell[]; blockStart: boolean }

const cell = (text: string, rowSpan = 1): TableCell => ({ text, rowSpan, colSpan: 1 })

/** Equal neighbours merge: [a, a, b] -> [{a, 2}, null, {b, 1}]. */
function mergeRuns(values: string[]): TableCell[] {
  const out: TableCell[] = []
  let i = 0
  while (i < values.length) {
    let j = i
    while (j + 1 < values.length && values[j + 1] === values[i]) j++
    out.push(cell(values[i], j - i + 1))
    for (let k = i + 1; k <= j; k++) out.push(null)
    i = j + 1
  }
  return out
}

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const jamText = (e: PrintExam) => (e.jam_mulai && e.jam_selesai ? `${e.jam_mulai.replace(':', '.')}-${e.jam_selesai.replace(':', '.')}` : '')

type Block = { exams: PrintExam[]; rows: TableRow[] }

/**
 * One row per mata kuliah x kelas, in date order (unscheduled last). The mata kuliah's own
 * cells merge down its kelas rows; dosen and keterangan merge when neighbours are equal.
 * Consecutive university-run (MKWU) exams on the same date and hour fold into one block:
 * shared HARI/TANGGAL, and a single "UNIVERSITAS" cell over everything from JAM onward.
 */
export function buildExamRows(exams: PrintExam[]): TableRow[] {
  const byMk = new Map<string, PrintExam[]>()
  for (const e of exams) byMk.set(e.kode_mk, [...(byMk.get(e.kode_mk) ?? []), e])

  const when = (b: PrintExam[]) => `${b[0].tanggal ?? '9999'} ${b[0].jam_mulai ?? ''}`
  const blocks: Block[] = [...byMk.values()]
    .map((list) => [...list].sort((a, b) => a.kelas.localeCompare(b.kelas)))
    .sort((a, b) => when(a).localeCompare(when(b)) || Number(b[0].mkwu) - Number(a[0].mkwu) || a[0].kode_mk.localeCompare(b[0].kode_mk))
    .map((list) => ({ exams: list, rows: blockRows(list) }))

  const sameSlot = (a: PrintExam, b: PrintExam) => a.tanggal === b.tanggal && a.jam_mulai === b.jam_mulai && a.jam_selesai === b.jam_selesai
  for (let i = 0; i < blocks.length; ) {
    let j = i
    if (blocks[i].exams[0].mkwu) {
      while (j + 1 < blocks.length && blocks[j + 1].exams[0].mkwu && sameSlot(blocks[j + 1].exams[0], blocks[i].exams[0])) j++
      foldUniversity(blocks.slice(i, j + 1))
    }
    i = j + 1
  }
  return blocks.flatMap((b) => b.rows)
}

function blockRows(list: PrintExam[]): TableRow[] {
  const n = list.length
  const head = list[0]
  const dosen = mergeRuns(list.map((e) => e.dosen.join('\n').toUpperCase()))
  const keterangan = mergeRuns(list.map((e) => KETERANGAN_LABEL[e.keterangan].toUpperCase()))

  return list.map((e, i) => {
    const first = i === 0
    return {
      blockStart: first,
      cells: [
        first ? cell(head.kode_mk, n) : null,
        first ? cell(head.nama_mk.toUpperCase(), n) : null,
        first ? cell(head.sks === null ? '' : String(head.sks), n) : null,
        first ? cell(head.tanggal ? hariLabel(hariFromTanggal(head.tanggal)).toUpperCase() : '', n) : null,
        first ? cell(head.tanggal ? dmy(head.tanggal) : '', n) : null,
        first ? cell(jamText(head), n) : null,
        dosen[i],
        cell(e.kelas),
        cell(e.pengawas.join('\n').toUpperCase()),
        cell(e.ruangan),
        keterangan[i],
      ],
    }
  })
}

function foldUniversity(run: Block[]) {
  const rows = run.flatMap((b) => b.rows)
  const total = rows.length
  rows.forEach((row, i) => {
    for (let c = COL.jam; c <= COL.keterangan; c++) row.cells[c] = null
    if (i > 0) {
      row.cells[COL.hari] = null
      row.cells[COL.tanggal] = null
    }
  })
  const first = rows[0].cells
  first[COL.hari] = cell(first[COL.hari]?.text ?? '', total)
  first[COL.tanggal] = cell(first[COL.tanggal]?.text ?? '', total)
  first[COL.jam] = { text: 'UNIVERSITAS', rowSpan: total, colSpan: COL.keterangan - COL.jam + 1 }
}
