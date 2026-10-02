import ExcelJS from 'exceljs'
import { BORDER_ALL, estimateLines, mergedText } from '@/lib/xlsx'
import { EXAM_ALIGN, EXAM_COLUMNS, EXAM_WIDTHS } from '../exam-rows'
import type { UjianSheet } from './ujian-cetak-data'

const COLUMN_COUNT = EXAM_COLUMNS.length
const MIN_ROW_HEIGHT = 24 // points; the template's rows are about this tall
const LINE = 16
const SIGNATURE_FROM = 7 // 1-based: the jabatan/nama block sits over DOSEN PENGAMPU..PENGAWAS, as in the template
const SIGNATURE_TO = 9

const font = (bold = false): Partial<ExcelJS.Font> => ({ name: 'Arial', size: 11, bold })

export async function buildUjianXlsx(props: {
  sheets: UjianSheet[]
  namaPenandatangan: string
  jabatanPenandatangan: string
}): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook()
  // Each semester is its own sheet, so "Semua semester" converts to one PDF with every semester.
  for (const sheet of props.sheets) addSheet(workbook, sheet, props)
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}

function addSheet(workbook: ExcelJS.Workbook, { name, headerLines, rows }: UjianSheet, props: { namaPenandatangan: string; jabatanPenandatangan: string }) {
  const sheet = workbook.addWorksheet(name, {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { top: 0.75, bottom: 0.75, left: 0.73, right: 0.2, header: 0.31, footer: 0.31 },
      horizontalCentered: true,
    },
  })
  sheet.columns = EXAM_WIDTHS.map((width) => ({ width }))

  const title = (r: number, text: string, opts: Parameters<typeof mergedText>[4]) => {
    const cell = mergedText(sheet, r, COLUMN_COUNT, text, opts)
    cell.font = { ...font(opts?.bold), ...cell.font, name: 'Arial', size: 11 }
  }

  let r = 1
  for (const line of headerLines) title(r++, line, { bold: true, size: 11, align: 'center' })
  r++

  const headerRow = r
  sheet.getRow(r).height = MIN_ROW_HEIGHT
  EXAM_COLUMNS.forEach((label, i) => {
    const cell = sheet.getCell(r, i + 1)
    cell.value = label
    cell.font = font(true)
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = BORDER_ALL
  })
  r++

  if (rows.length === 0) title(r++, 'Tidak ada data jadwal untuk pilihan ini.', { align: 'center' })

  // Row heights: Excel does not auto-fit for every viewer, so bake them in. Cells on one row
  // set the floor; a cell merged down several rows may need the span to be taller than that.
  const first = r
  const heights = rows.map((row) =>
    Math.max(MIN_ROW_HEIGHT, ...row.cells.map((c, i) => (c && c.rowSpan === 1 && c.colSpan === 1 ? estimateLines(c.text, EXAM_WIDTHS[i]) * LINE : 0))),
  )
  rows.forEach((row, ri) =>
    row.cells.forEach((c, i) => {
      if (c && c.rowSpan > 1) {
        const width = EXAM_WIDTHS.slice(i, i + c.colSpan).reduce((a, b) => a + b, 0)
        const deficit = estimateLines(c.text, width) * LINE - heights.slice(ri, ri + c.rowSpan).reduce((a, b) => a + b, 0)
        if (deficit > 0) heights[ri + c.rowSpan - 1] += deficit
      }
    }),
  )

  rows.forEach((row, ri) => {
    sheet.getRow(first + ri).height = heights[ri]
    row.cells.forEach((c, i) => {
      if (!c) return
      const cell = sheet.getCell(first + ri, i + 1)
      cell.value = c.text
      cell.font = font()
      cell.alignment = { vertical: 'middle', horizontal: c.colSpan > 1 ? 'center' : EXAM_ALIGN[i], wrapText: true }
      cell.border = BORDER_ALL
      // Style first, merge second: exceljs copies the master's style to the covered cells.
      if (c.rowSpan > 1 || c.colSpan > 1) sheet.mergeCells(first + ri, i + 1, first + ri + c.rowSpan - 1, i + c.colSpan)
    })
  })
  r = first + rows.length

  const signature = (row: number, text: string, bold: boolean) => {
    sheet.mergeCells(row, SIGNATURE_FROM, row, SIGNATURE_TO)
    const cell = sheet.getCell(row, SIGNATURE_FROM)
    cell.value = text
    cell.font = font(bold)
    cell.alignment = { horizontal: 'center' }
  }
  r += 2
  signature(r, props.jabatanPenandatangan, false)
  r += 5
  signature(r, props.namaPenandatangan, true)

  // Repeats the column header row on every printed page (Excel's "Print Titles").
  sheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`
}
