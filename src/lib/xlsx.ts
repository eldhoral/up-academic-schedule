import type ExcelJS from 'exceljs'
import { parseImageDataUri } from './print'

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

const EXCEL_IMAGE_TYPES: Record<string, 'png' | 'jpeg' | 'gif'> = { png: 'png', jpeg: 'jpeg', jpg: 'jpeg', gif: 'gif' }
// ponytail: a fixed box like the Dekan's on the Surat (120x60); a non-2:1 upload is stretched. Read the image's own size if that shows.
const SIGNATURE_PX = { width: 120, height: 60 }
// One copy of the image per workbook, however many semester sheets show it.
const signatureIds = new WeakMap<ExcelJS.Workbook, number>()

/**
 * The penandatangan's signature image (Pengaturan "Gambar Tanda Tangan"), if one is uploaded, centred over
 * columns from..to (1-based) in the blank rows that start right under the jabatan row. No image, no change.
 */
export function addSignatureImage(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  dataUri: string,
  at: { from: number; to: number; jabatanRow: number },
) {
  const image = parseImageDataUri(dataUri)
  const extension = image && EXCEL_IMAGE_TYPES[image.format]
  if (!extension) return
  // Excel column width units to pixels, for the default 11pt font.
  const px = (col: number) => Math.round((sheet.getColumn(col).width ?? 9) * 7 + 5)
  let col = at.from
  let left = 0
  for (let c = at.from; c <= at.to; c++) left += px(c)
  left = Math.max(0, (left - SIGNATURE_PX.width) / 2)
  while (col < at.to && left >= px(col)) left -= px(col++)
  // A native anchor (0-based, offsets in EMU, 9525 per pixel): exceljs's fractional `col` scales offsets by its own column units, not pixels.
  const tl = { nativeCol: col - 1, nativeColOff: Math.round(left * 9525), nativeRow: at.jabatanRow, nativeRowOff: 0 }
  let id = signatureIds.get(workbook)
  if (id === undefined) signatureIds.set(workbook, (id = workbook.addImage({ base64: image.base64, extension })))
  sheet.addImage(id, {
    tl: tl as unknown as { col: number; row: number },
    ext: SIGNATURE_PX,
    editAs: 'oneCell',
  })
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
  cell.alignment = { horizontal: opts.align ?? 'left', vertical: 'top' }
  return cell
}
