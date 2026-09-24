import ExcelJS from 'exceljs'
import { lecturerDisplayName } from '@/lib/import/tables'
import { HARI_DB } from '@/lib/hari'
import { REKAP_COLUMN_ALIGN, REKAP_COLUMN_LABELS, REKAP_COLUMN_WIDTHS, REKAP_SIGNATURE_START_COLUMN } from './rekap-columns'
import { LOGO_UP_PNG_BASE64 } from './logo-up'
import { FOOTER_BANNER_PNG_BASE64 } from './footer-banner'
import type { ScheduleRow, Lecturer } from '../penjadwalan-types'

const COLUMN_COUNT = REKAP_COLUMN_WIDTHS.length
const THIN = { style: 'thin' as const, color: { argb: 'FF000000' } }
const BORDER_ALL = { top: THIN, left: THIN, bottom: THIN, right: THIN }
const hariIndex = (h: string) => (HARI_DB as readonly string[]).indexOf(h)

function estimateLines(text: string, widthUnits: number): number {
  if (!text) return 1
  const charsPerLine = Math.max(6, Math.round(widthUnits * 0.85))
  return text.split('\n').reduce((sum, seg) => sum + Math.max(1, Math.ceil(seg.length / charsPerLine)), 0)
}

function mergedText(
  sheet: ExcelJS.Worksheet,
  row: number,
  text: string,
  opts: { bold?: boolean; size?: number; underline?: boolean; align?: 'left' | 'center' } = {},
) {
  sheet.mergeCells(row, 1, row, COLUMN_COUNT)
  const cell = sheet.getCell(row, 1)
  cell.value = text
  cell.font = { bold: opts.bold ?? false, size: opts.size ?? 11, underline: opts.underline ?? false }
  cell.alignment = { horizontal: opts.align ?? 'left', wrapText: true }
  return cell
}

function sortByHariJam(rows: ScheduleRow[]): ScheduleRow[] {
  return [...rows].sort((a, b) => hariIndex(a.hari) - hariIndex(b.hari) || a.jam_mulai.localeCompare(b.jam_mulai))
}

function writeTableSection(sheet: ExcelJS.Worksheet, r: number, title: string, rows: ScheduleRow[]): number {
  mergedText(sheet, r, title, { bold: true, size: 10, align: 'left' })
  r++

  if (rows.length === 0) {
    mergedText(sheet, r, '—', { align: 'center', size: 10 })
    r++
    return r
  }

  sortByHariJam(rows).forEach((row, i) => {
    const values = [
      i + 1,
      row.courses?.nama_mk ?? row.kode_mk,
      row.courses?.sks ?? '',
      row.hari,
      `${row.jam_mulai.slice(0, 5)} - ${row.jam_selesai.slice(0, 5)}`,
      row.kelas,
      row.rooms?.nama ?? '',
    ]
    values.forEach((value, col) => {
      const cell = sheet.getCell(r, col + 1)
      cell.value = value
      cell.alignment = { vertical: 'middle', horizontal: REKAP_COLUMN_ALIGN[col], wrapText: true }
      cell.border = BORDER_ALL
    })
    const lines = Math.max(...values.map((v, col) => estimateLines(String(v ?? ''), REKAP_COLUMN_WIDTHS[col])))
    sheet.getRow(r).height = lines * 16
    r++
  })
  return r
}

// Logo sized/positioned and kop text font/alignment match the reference's
// header1.xml exactly (wp:extent for the image, w:ind + rFonts/sz per run):
// a ~5.4x3.4cm logo with the text starting to its right, not centered above
// it -- title in Ebrima 18pt bold, address lines in the default 12pt.
function writeLetterheadAndRule(sheet: ExcelJS.Worksheet, imageId: number, r: number, kopLines: string[]): number {
  sheet.addImage(imageId, { tl: { col: 0, row: r - 1 }, ext: { width: 205, height: 130 } })

  kopLines.forEach((line, i) => {
    const cell = sheet.getCell(r + i, 3)
    cell.value = line
    cell.font = i === 0 ? { name: 'Ebrima', bold: true, size: 18 } : { size: 12 }
    cell.alignment = { horizontal: 'left', wrapText: false }
    sheet.getRow(r + i).height = i === 0 ? 24 : 18
  })
  const lastRow = r + kopLines.length - 1
  sheet.getRow(lastRow).eachCell({ includeEmpty: true }, (cell) => {
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF000000' } } }
  })
  return lastRow + 1
}

// Excel has no equivalent of Word's floating footer image, so this renders
// as the last block of page content instead of a true fixed-position
// footer -- it lands near the bottom because each lecturer's letter is
// short relative to the page, not because it's pinned there.
function writeFooterBanner(sheet: ExcelJS.Worksheet, imageId: number, r: number): number {
  sheet.addImage(imageId, { tl: { col: 0, row: r - 1 }, ext: { width: 760, height: 65 } })
  return r + 4
}

/** Sanitizes a lecturer's name into a safe, unique-enough Excel sheet name (max 31 chars, no []:*?/\). */
function sheetNameFor(lecturer: Lecturer, index: number): string {
  const safe = lecturer.nama.replace(/[[\]:*?/\\]/g, '').trim() || `Dosen ${index + 1}`
  return `${index + 1}. ${safe}`.slice(0, 31)
}

export async function buildSuratXlsx(data: {
  lecturersToRender: Lecturer[]
  byDosen: Map<string, ScheduleRow[]>
  academicYearLabel: string
  tahun: string
  term: string
  namaFakultas: string
  kota: string
  kopLines: string[]
  nomorSurat: string
  lampiranSurat: string
  perihalSurat: string
  catatanPerkuliahan: string
  namaDekan: string
  jabatanDekan: string
  gambarTandaTanganDekan: string
  tembusanLines: string[]
  ukuranKertas: string
  orientasi: string
}): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook()
  const paperSize = data.ukuranKertas === 'Legal' ? 5 : data.ukuranKertas === 'Letter' ? undefined : 9
  const pageSetup = {
    paperSize,
    orientation: (data.orientasi === 'landscape' ? 'landscape' : 'portrait') as 'landscape' | 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { top: 0.6, bottom: 0.6, left: 0.4, right: 0.4, header: 0.3, footer: 0.3 },
    horizontalCentered: false,
  }
  const logoImageId = workbook.addImage({ base64: `data:image/png;base64,${LOGO_UP_PNG_BASE64}`, extension: 'png' })
  const footerImageId = workbook.addImage({ base64: `data:image/png;base64,${FOOTER_BANNER_PNG_BASE64}`, extension: 'png' })
  const tanggal = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  if (data.lecturersToRender.length === 0) {
    const sheet = workbook.addWorksheet('Surat', { pageSetup })
    sheet.columns = REKAP_COLUMN_WIDTHS.map((width) => ({ width }))
    mergedText(sheet, 1, 'Tidak ada data mengajar untuk pilihan ini.', { align: 'center' })
    return new Uint8Array(await workbook.xlsx.writeBuffer())
  }

  // One worksheet per lecturer: every worksheet starts on its own printed
  // page, which is the only page-break mechanism Aspose's convert endpoint
  // actually honors -- exceljs's manual row page breaks are silently ignored.
  data.lecturersToRender.forEach((lecturer, index) => {
    const sheet = workbook.addWorksheet(sheetNameFor(lecturer, index), { pageSetup })
    sheet.columns = REKAP_COLUMN_WIDTHS.map((width) => ({ width }))

    let r = writeLetterheadAndRule(sheet, logoImageId, 1, data.kopLines)
    r++

    sheet.mergeCells(r, 1, r, 3)
    const nomorCell = sheet.getCell(r, 1)
    nomorCell.value = `Nomor: ${data.nomorSurat}`
    nomorCell.alignment = { horizontal: 'left' }

    sheet.mergeCells(r, 5, r, COLUMN_COUNT)
    const dateCell = sheet.getCell(r, 5)
    dateCell.value = `${data.kota}, ${tanggal}`
    dateCell.alignment = { horizontal: 'right' }
    r++

    mergedText(sheet, r, `Lampiran: ${data.lampiranSurat}`)
    r++
    mergedText(sheet, r, `Perihal: ${data.perihalSurat}`)
    r++
    r++

    mergedText(sheet, r, 'Kepada Yth.')
    r++
    mergedText(sheet, r, `Bapak/Ibu/Sdr. ${lecturerDisplayName(lecturer)}`)
    r++
    mergedText(sheet, r, `Dosen ${data.namaFakultas}`)
    r++
    mergedText(sheet, r, 'Universitas Pancasila')
    r++
    mergedText(sheet, r, 'Di Tempat')
    r++
    r++

    mergedText(sheet, r, 'Dengan hormat,')
    r++
    r++

    mergedText(sheet, r, `Berikut disampaikan jadwal mengajar Bapak/Ibu/Sdr. pada Semester ${data.term} Tahun Akademik ${data.tahun} :`)
    r++

    REKAP_COLUMN_LABELS.forEach((label, i) => {
      const cell = sheet.getCell(r, i + 1)
      cell.value = label
      cell.font = { bold: true }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = BORDER_ALL
    })
    r++

    const rows = data.byDosen.get(lecturer.kode_dosen) ?? []
    r = writeTableSection(sheet, r, 'Kelas Reguler', rows.filter((s) => s.jenis_kelas === 'reguler'))
    r = writeTableSection(sheet, r, 'Kelas Reguler Khusus', rows.filter((s) => s.jenis_kelas === 'regsus'))
    r++

    const catatanLines = estimateLines(data.catatanPerkuliahan, REKAP_COLUMN_WIDTHS.reduce((a, b) => a + b, 0))
    mergedText(sheet, r, data.catatanPerkuliahan, { size: 10 })
    sheet.getRow(r).height = catatanLines * 16
    r++
    r++

    mergedText(sheet, r, 'Demikian agar menjadi perhatian.', { size: 10 })
    r++
    r++

    const signatureCol = REKAP_SIGNATURE_START_COLUMN + 1
    const signatureText = (row: number, text: string, opts: { bold?: boolean; underline?: boolean }) => {
      sheet.mergeCells(row, signatureCol, row, COLUMN_COUNT)
      const cell = sheet.getCell(row, signatureCol)
      cell.value = text
      cell.font = { bold: opts.bold ?? false, underline: opts.underline ?? false }
      cell.alignment = { horizontal: 'center' }
    }
    signatureText(r, data.jabatanDekan, {})
    r += 4
    signatureText(r, data.namaDekan, { bold: true, underline: true })
    r++
    r++

    mergedText(sheet, r, 'Tembusan Kepada Yth.:', { size: 10 })
    r++
    for (const line of data.tembusanLines) {
      mergedText(sheet, r, line, { size: 10 })
      r++
    }
    r++
    writeFooterBanner(sheet, footerImageId, r)
  })

  return new Uint8Array(await workbook.xlsx.writeBuffer())
}
