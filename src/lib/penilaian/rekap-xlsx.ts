import ExcelJS from 'exceljs'
import { BORDER_ALL } from '@/lib/xlsx'
import type { BarisNilai } from './aturan'
import { baris } from './nilai'
import type { DosenNilai, RekapBimbingan } from './rekap'

const KOLOM: [string, number][] = [
  ['No', 5], ['NPM', 14], ['Nama', 30], ['Judul Skripsi', 50], ['IPK', 8],
  ['Dosen Pembimbing I', 32], ['Nilai I', 9], ['Huruf I', 8],
  ['Dosen Pembimbing II', 32], ['Nilai II', 9], ['Huruf II', 8],
  ['Nilai Bimbingan', 16], ['Huruf', 8],
]
const ANGKA = [5, 7, 10, 12] // 1-based columns holding numbers

/** The recap as xlsx. Numbers stay numbers (0.00); a missing grade or letter is a blank cell. */
export async function buildRekapBimbinganXlsx(rows: RekapBimbingan[], tabel: BarisNilai[]): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Nilai Bimbingan', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = KOLOM.map(([header, width]) => ({ header, width }))
  const huruf = (n: number | null) => (n === null ? null : baris(n, tabel).huruf)
  // Marked on the name, not the grade, so the grade cell stays a number.
  const dosen = (d: DosenNilai) => (d.manual ? `${d.nama} (input manual)` : d.nama)

  rows.forEach((r, i) => {
    sheet.addRow([
      i + 1, r.npm, r.nama, r.judul, r.ipk,
      dosen(r.dospem1), r.dospem1.nilai, huruf(r.dospem1.nilai),
      dosen(r.dospem2), r.dospem2.nilai, huruf(r.dospem2.nilai),
      r.bimbingan, huruf(r.bimbingan),
    ])
  })

  sheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = BORDER_ALL
      cell.alignment = { vertical: 'top', wrapText: col === 4 }
      if (rowNumber === 1) cell.font = { bold: true }
      else if (ANGKA.includes(col)) cell.numFmt = '0.00'
    })
  })
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  return new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer)
}
