import ExcelJS from 'exceljs'
import { BORDER_ALL, estimateLines, mergedText } from '@/lib/xlsx'
import { defenseColumns } from '../defense-blocks'
import type { Prodi } from '@/lib/prodi'
import type { DefenseJenis } from '../defense-types'
import type { SidangCetakData } from './sidang-cetak-data'

const MIN_ROW_HEIGHT = 22
const LINE = 16

type Props = Pick<SidangCetakData, 'sheets' | 'zoomId' | 'zoomPasscode' | 'namaWakilDekan' | 'jabatanWakilDekan' | 'namaPenandatangan' | 'jabatanPenandatangan'> & { jenis: DefenseJenis; prodi: Prodi }

/** One worksheet per block (date x room, or date x kelompok), so a PDF is one page run per block. */
export async function buildSidangXlsx(props: Props): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook()
  if (props.sheets.length === 0) {
    const empty = workbook.addWorksheet('Kosong')
    empty.getCell(1, 1).value = 'Tidak ada data jadwal untuk pilihan ini.'
  }
  for (const sheet of props.sheets) addSheet(workbook, sheet, props)
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}

function addSheet(workbook: ExcelJS.Workbook, { name, headerLines, rows, kelompok }: Props['sheets'][number], props: Props) {
  const columns = defenseColumns(props.prodi, props.jenis)
  const count = columns.length
  const size = props.jenis === 'sidang' ? 12 : 11 // the templates' type sizes
  const font = (bold = false): Partial<ExcelJS.Font> => ({ name: 'Arial', size, bold })
  // Row heights in points, from the templates (prasidang: Jadwal Prasidang Gasal 2025-2026, sidang: jadwal sidang master).
  const titleHeight = props.jenis === 'sidang' ? 15.75 : 15
  const headerHeight = props.jenis === 'sidang' ? 31.5 : 30

  const sheet = workbook.addWorksheet(name, {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { top: 0.6, bottom: 0.6, left: 0.5, right: 0.5, header: 0.3, footer: 0.3 },
      horizontalCentered: true,
    },
  })
  sheet.columns = columns.map((c) => ({ width: c.width }))

  const merged = (r: number, from: number, to: number, text: string, bold: boolean, align: 'left' | 'center') => {
    sheet.mergeCells(r, from, r, to)
    const cell = sheet.getCell(r, from)
    cell.value = text
    cell.font = font(bold)
    cell.alignment = { horizontal: align, vertical: 'top', wrapText: true }
  }

  let r = 1
  for (const line of headerLines) {
    const cell = mergedText(sheet, r, count, line, { bold: true, align: 'center' })
    cell.font = font(true)
    sheet.getRow(r++).height = titleHeight
  }
  r++

  if (props.jenis === 'prasidang') {
    // Prasidang is on Zoom, one breakout room per kelompok.
    sheet.getRow(r).height = titleHeight
    merged(r, 1, 3, `ID ZOOM : ${props.zoomId}`, true, 'center')
    merged(r, 4, 5, `PASSCODE : ${props.zoomPasscode}`, true, 'center')
    merged(r, 6, 7, `(BREAK OUT ROOM KELOMPOK ${kelompok ?? ''})`, true, 'center')
    r += 2
  } else {
    r++ // sidang leaves two blank rows above the table
  }

  sheet.getRow(r).height = headerHeight
  columns.forEach((c, i) => {
    const cell = sheet.getCell(r, i + 1)
    cell.value = c.header
    cell.font = font(true)
    cell.alignment = { vertical: 'top', horizontal: 'center', wrapText: true }
    cell.border = BORDER_ALL
  })
  const headerRow = r
  r++

  for (const row of rows) {
    sheet.getRow(r).height = Math.max(MIN_ROW_HEIGHT, ...row.cells.map((v, i) => estimateLines(v, columns[i].width) * LINE))
    row.cells.forEach((v, i) => {
      const cell = sheet.getCell(r, i + 1)
      cell.value = v // NPM stays text: no leading-zero loss, no scientific notation
      cell.font = font()
      cell.alignment = { vertical: 'top', horizontal: columns[i].center ? 'center' : 'left', wrapText: true }
      cell.border = BORDER_ALL
    })
    r++
  }

  // Signatures: Wakil Dekan I on the left ("MENGETAHUI," only on prasidang), Kaprodi on the right.
  // Placement follows each template: prasidang left block A:C, names 4 rows down; sidang B:C, 5 rows down.
  const leftFrom = props.jenis === 'sidang' ? 2 : 1
  const rightFrom = 6
  const rightTo = props.jenis === 'sidang' ? 8 : 7
  r += 1
  if (props.jenis === 'prasidang') merged(r++, leftFrom, 3, 'MENGETAHUI,', false, 'center')
  merged(r, leftFrom, 3, props.jabatanWakilDekan, false, 'center')
  merged(r, rightFrom, rightTo, props.jabatanPenandatangan, false, 'center')
  r += props.jenis === 'sidang' ? 5 : 4
  merged(r, leftFrom, 3, props.namaWakilDekan, true, 'center')
  merged(r, rightFrom, rightTo, props.namaPenandatangan, true, 'center')

  // Repeats the column header row on every printed page (Excel's "Print Titles").
  sheet.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`
}
