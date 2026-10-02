import ExcelJS from 'exceljs'
import { groupSchedulesByKelas } from './schedule-rows'
import { COLUMN_ALIGN, COLUMN_LABELS, COLUMN_WIDTHS, SIGNATURE_START_COLUMN } from './columns'
import { BORDER_ALL, mergedText as sharedMergedText, setRowHeightForContent } from '@/lib/xlsx'
import type { ScheduleRow } from '../penjadwalan-types'

const COLUMN_COUNT = COLUMN_WIDTHS.length

const heightFor = (sheet: ExcelJS.Worksheet, rowIndex: number, values: unknown[]) => setRowHeightForContent(sheet, rowIndex, values, COLUMN_WIDTHS)
const mergedText = (sheet: ExcelJS.Worksheet, row: number, text: string, opts?: Parameters<typeof sharedMergedText>[4]) =>
  sharedMergedText(sheet, row, COLUMN_COUNT, text, opts)

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
  heightFor(sheet, r, headerLabels)
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
      heightFor(sheet, r, values)
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
