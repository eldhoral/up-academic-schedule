import ExcelJS from 'exceljs'
import { BORDER_ALL } from '@/lib/xlsx'
import type { BarisNilai } from './aturan'
import { baris } from './nilai'
import { EMAIL_LABEL, type DosenNilai, type RekapAkhir, type RekapBimbingan } from './rekap'

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

const KOLOM_AKHIR: [string, number][] = [
  ['NPM', 14], ['Nama', 30], ['Judul', 50], ['Nilai Bimbingan', 16],
  ['Ketua', 32], ['Nilai Ketua', 12], ['Anggota I', 32], ['Nilai I', 9], ['Anggota II', 32], ['Nilai II', 9],
  ['Nilai Sidang', 13], ['Huruf Sidang', 13], ['Yudisium', 22], ['Nilai Akhir', 16], ['Huruf', 8],
  ['Bobot Mutu', 12], ['IPK Sebelum', 12], ['IPK Setelah', 12], ['Predikat', 22], ['Status Email', 14],
]
const ANGKA_AKHIR = [4, 6, 8, 10, 11, 14, 16, 17, 18] // 1-based columns holding numbers

/**
 * The Nilai Akhir recap as xlsx. Numbers stay numbers (0.00); a missing value is a blank cell.
 * A sidang that is not final puts its reason in the Nilai Akhir cell.
 */
export async function buildRekapAkhirXlsx(rows: RekapAkhir[]): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Nilai Akhir', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = KOLOM_AKHIR.map(([header, width]) => ({ header, width }))

  for (const r of rows) {
    const h = r.hasil
    const lengkap = h.status === 'lengkap'
    sheet.addRow([
      r.npm, r.nama, r.judul, r.bimbingan,
      r.penguji.ketua.nama, r.penguji.ketua.nilai, r.penguji.anggota_1.nama, r.penguji.anggota_1.nilai, r.penguji.anggota_2.nama, r.penguji.anggota_2.nilai,
      h.nilaiSidang, r.hurufSidang, r.yudisium,
      lengkap ? h.nilaiAkhir : h.alasan, lengkap ? h.huruf : null,
      lengkap ? h.mutu : null, r.ipkSebelum, lengkap ? h.ipkSetelah : null, lengkap ? h.predikat : null,
      r.emailStatus ? (EMAIL_LABEL[r.emailStatus] ?? r.emailStatus) : null,
    ])
  }

  sheet.eachRow((row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.border = BORDER_ALL
      cell.alignment = { vertical: 'top', wrapText: col === 3 || col === 14 }
      if (rowNumber === 1) cell.font = { bold: true }
      else if (ANGKA_AKHIR.includes(col) && typeof cell.value === 'number') cell.numFmt = '0.00'
    })
  })
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  return new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer)
}
