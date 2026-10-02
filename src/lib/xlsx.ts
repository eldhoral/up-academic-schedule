import type ExcelJS from 'exceljs'

// Helpers shared by every exceljs document builder (kuliah, ujian, sidang).

const THIN = { style: 'thin' as const, color: { argb: 'FF000000' } }
export const BORDER_ALL = { top: THIN, left: THIN, bottom: THIN, right: THIN }

/**
 * Desktop Excel auto-fits row height for wrapped text when a file is opened,
 * but other viewers (and server-side converters) clip wrapped text to whatever
 * height is stored, so we estimate and bake in the height ourselves.
 * `0.85` is a deliberately conservative chars-per-line factor: overestimating
 * only wastes a little whitespace, underestimating clips real text.
 */
export function estimateLines(value: unknown, widthUnits: number): number {
  const text = String(value ?? '')
  if (!text) return 1
  const charsPerLine = Math.max(6, Math.round(widthUnits * 0.85))
  // A literal "\n" forces a break; each segment may still wrap further on its own.
  return text.split('\n').reduce((sum, segment) => sum + Math.max(1, Math.ceil(segment.length / charsPerLine)), 0)
}

/** Sets a row tall enough for the longest wrapped value; `widths` are the column widths in Excel units. */
export function setRowHeightForContent(sheet: ExcelJS.Worksheet, rowIndex: number, values: unknown[], widths: number[]) {
  const lines = Math.max(...values.map((value, i) => estimateLines(value, widths[i])))
  sheet.getRow(rowIndex).height = lines * 16
}

/** One full-width merged line (titles, notes). */
export function mergedText(
  sheet: ExcelJS.Worksheet,
  row: number,
  columnCount: number,
  text: string,
  opts: { bold?: boolean; size?: number; underline?: boolean; align?: 'left' | 'center' } = {},
) {
  sheet.mergeCells(row, 1, row, columnCount)
  const cell = sheet.getCell(row, 1)
  cell.value = text
  cell.font = { bold: opts.bold ?? false, size: opts.size ?? 10, underline: opts.underline ?? false }
  cell.alignment = { horizontal: opts.align ?? 'left' }
  return cell
}
