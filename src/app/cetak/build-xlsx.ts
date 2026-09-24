import ExcelJS from 'exceljs'
import { groupSchedulesByKelas } from './schedule-rows'
import { COLUMN_ALIGN, COLUMN_LABELS, COLUMN_WIDTHS, SIGNATURE_START_COLUMN } from './columns'
import type { ScheduleRow } from '../penjadwalan-types'

const COLUMN_COUNT = COLUMN_WIDTHS.length

const THIN = { style: 'thin' as const, color: { argb: 'FF000000' } }
const BORDER_ALL = { top: THIN, left: THIN, bottom: THIN, right: THIN }

function mergedText(
  sheet: ExcelJS.Worksheet,
  row: number,
  text: string,
  opts: { bold?: boolean; size?: number; underline?: boolean; align?: 'left' | 'center' } = {},
) {
  sheet.mergeCells(row, 1, row, COLUMN_COUNT)
  const cell = sheet.getCell(row, 1)
  cell.value = text
  cell.font = { bold: opts.bold ?? false, size: opts.size ?? 10, underline: opts.underline ?? false }
  cell.alignment = { horizontal: opts.align ?? 'left' }
  return cell
}

export async function buildXlsx(props: {
  schedules: ScheduleRow[]
  headerLines: string[]
  zoomId: string
  zoomPasscode: string
  keteranganLines: string[]
  namaPenandatangan: string
  jabatanPenandatangan: string
  ukuranKertas: string
  orientasi: string
}): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook()
  // exceljs paper-size codes: 5 = Legal, 9 = A4, undefined = Letter (its default)
  const paperSize = props.ukuranKertas === 'Legal' ? 5 : props.ukuranKertas === 'Letter' ? undefined : 9
  const sheet = workbook.addWorksheet('Jadwal', {
    pageSetup: {
      paperSize,
      orientation: props.orientasi === 'landscape' ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { top: 0.6, bottom: 0.6, left: 0.4, right: 0.4, header: 0.3, footer: 0.3 },
      horizontalCentered: true,
      scale: 66,
    },
  })
  sheet.columns = COLUMN_WIDTHS.map((width) => ({ width }))

  let r = 1
  for (const line of props.headerLines) {
    mergedText(sheet, r, line, { bold: true, size: 13, align: 'center' })
    r++
  }
  mergedText(sheet, r, `ID ZOOM : ${props.zoomId}${props.zoomPasscode ? `     PASSCODE : ${props.zoomPasscode}` : ''}`, {
    bold: true,
    size: 13,
    align: 'center',
  })
  r += 2

  const kelasGroups = groupSchedulesByKelas(props.schedules)

  const headerRowIndex = r
  const headerLabels = [...COLUMN_LABELS.slice(0, -1), `BOR ZOOM \n${props.zoomId}`]
  headerLabels.forEach((label, i) => {
    const cell = sheet.getCell(r, i + 1)
    cell.value = label
    cell.font = { bold: true }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = BORDER_ALL
  })
  r++

  if (kelasGroups.length === 0) {
    mergedText(sheet, r, 'Tidak ada data jadwal untuk pilihan ini.', { align: 'center' })
    r++
  }

  for (const [kelas, rows] of kelasGroups) {
    mergedText(sheet, r, `KELAS ${kelas}`, { bold: true, size: 10, align: 'center' })
    sheet.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.border = BORDER_ALL
    })
    r++

    for (const row of rows) {
      const values = [row.kode_mk, row.mata_kuliah, row.sks, row.hari, row.jam, row.dosen, row.ruangan, row.zoom]
      values.forEach((value, i) => {
        const cell = sheet.getCell(r, i + 1)
        cell.value = value
        cell.alignment = { vertical: 'middle', horizontal: COLUMN_ALIGN[i], wrapText: true }
        cell.border = BORDER_ALL
      })
      r++
    }
  }

  r++
  mergedText(sheet, r, 'KETERANGAN:', { bold: true })
  r++
  for (const line of props.keteranganLines) {
    mergedText(sheet, r, line)
    r++
  }

  const signatureCol = SIGNATURE_START_COLUMN + 1
  const signatureText = (row: number, text: string, opts: { bold?: boolean; underline?: boolean }) => {
    sheet.mergeCells(row, signatureCol, row, COLUMN_COUNT)
    const cell = sheet.getCell(row, signatureCol)
    cell.value = text
    cell.font = { bold: opts.bold ?? false, underline: opts.underline ?? false }
    cell.alignment = { horizontal: 'center' }
  }

  r += 4
  signatureText(r, props.jabatanPenandatangan, {})
  r += 4
  signatureText(r, props.namaPenandatangan, { bold: true, underline: true })

  // Repeats the column header row on every printed page (Excel's "Print Titles").
  sheet.pageSetup.printTitlesRow = `${headerRowIndex}:${headerRowIndex}`

  return workbook.xlsx.writeBuffer()
}
