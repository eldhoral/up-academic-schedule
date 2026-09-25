import ExcelJS from 'exceljs'
import { groupSchedulesByKelas } from './schedule-rows'
import { COLUMN_ALIGN, COLUMN_LABELS, COLUMN_WIDTHS, SIGNATURE_START_COLUMN } from './columns'
import type { ScheduleRow } from '../penjadwalan-types'

const COLUMN_COUNT = COLUMN_WIDTHS.length

const THIN = { style: 'thin' as const, color: { argb: 'FF000000' } }
const BORDER_ALL = { top: THIN, left: THIN, bottom: THIN, right: THIN }

/**
 * Desktop Excel auto-fits row height for wrapped text when a file is opened,
 * but Aspose's server-side PDF conversion doesn't -- it clips wrapped text to
 * whatever height is stored, so we estimate and bake in the height ourselves.
 * `0.85` is a deliberately conservative chars-per-line factor: overestimating
 * only wastes a little whitespace, underestimating clips real text.
 */
function estimateLines(value: unknown, widthUnits: number): number {
  const text = String(value ?? '')
  if (!text) return 1
  const charsPerLine = Math.max(6, Math.round(widthUnits * 0.85))
  // A literal "\n" forces a break; each segment may still wrap further on its own.
  return text.split('\n').reduce((sum, segment) => sum + Math.max(1, Math.ceil(segment.length / charsPerLine)), 0)
}

function setRowHeightForContent(sheet: ExcelJS.Worksheet, rowIndex: number, values: unknown[]) {
  const lines = Math.max(...values.map((value, i) => estimateLines(value, COLUMN_WIDTHS[i])))
  sheet.getRow(rowIndex).height = lines * 16
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
  cell.font = { bold: opts.bold ?? false, size: opts.size ?? 10, underline: opts.underline ?? false }
  cell.alignment = { horizontal: opts.align ?? 'left' }
  return cell
}

type Sheet = { name: string; headerLines: string[]; schedules: ScheduleRow[] }

export async function buildXlsx(props: {
  sheets: Sheet[]
  zoomId: string
  zoomPasscode: string
  keteranganLines: string[]
  namaPenandatangan: string
  jabatanPenandatangan: string
  ukuranKertas: string
  orientasi: string
}): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook()
  // Each sheet prints as its own page run, so "Semua semester" converts to one PDF with every semester.
  for (const sheet of props.sheets) addSheet(workbook, sheet, props)
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}

function addSheet(
  workbook: ExcelJS.Workbook,
  { name, headerLines, schedules }: Sheet,
  props: Omit<Parameters<typeof buildXlsx>[0], 'sheets'>,
) {  // exceljs paper-size codes: 5 = Legal, 9 = A4, undefined = Letter (its default)
  const paperSize = props.ukuranKertas === 'Legal' ? 5 : props.ukuranKertas === 'Letter' ? undefined : 9
  const sheet = workbook.addWorksheet(name, {
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
  for (const line of headerLines) {
    mergedText(sheet, r, line, { bold: true, size: 13, align: 'center' })
    r++
  }
  mergedText(sheet, r, `ID ZOOM : ${props.zoomId}${props.zoomPasscode ? `     PASSCODE : ${props.zoomPasscode}` : ''}`, {
    bold: true,
    size: 13,
    align: 'center',
  })
  r += 2

  const kelasGroups = groupSchedulesByKelas(schedules)

  const headerRowIndex = r
  const headerLabels = [...COLUMN_LABELS.slice(0, -1), `BOR ZOOM \n${props.zoomId}`]
  setRowHeightForContent(sheet, r, headerLabels)
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
      setRowHeightForContent(sheet, r, values)
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
}
