import ExcelJS from 'exceljs'
import { BORDER_ALL, estimateLines, mergedText } from '@/lib/xlsx'
import type { RekapPengawasData } from './rekap-pengawas-data'

const DETAIL = ['NO', 'NAMA PENGAWAS', 'HARI', 'TANGGAL', 'JAM', 'KODE MK', 'MATA KULIAH', 'KELAS', 'PROGRAM', 'RUANGAN', 'KETERANGAN']
const WIDTHS = [5, 34, 14, 12, 14, 11, 32, 10, 16, 11, 16]
const COLUMN_COUNT = DETAIL.length
const LEFT = new Set([1, 6]) // NAMA PENGAWAS, MATA KULIAH
const MIN_ROW_HEIGHT = 22
const LINE = 16
const SIGNATURE_FROM = 8 // 1-based: the block sits at the right, over KELAS..KETERANGAN
const SIGNATURE_TO = 11

const font = (bold = false, size = 11): Partial<ExcelJS.Font> => ({ name: 'Arial', size, bold })

/** One sheet: a summary (who, how many), then every assignment grouped by person. */
export async function buildRekapPengawasXlsx(
  data: Pick<RekapPengawasData, 'headerLines' | 'groups' | 'totalTugas' | 'namaPenandatangan' | 'jabatanPenandatangan'>,
): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Rekap Pengawas', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { top: 0.75, bottom: 0.75, left: 0.5, right: 0.5, header: 0.31, footer: 0.31 },
      horizontalCentered: true,
    },
  })
  sheet.columns = WIDTHS.map((width) => ({ width }))

  const line = (r: number, text: string, opts: { bold?: boolean; size?: number; align?: 'left' | 'center' } = {}) => {
    const cell = mergedText(sheet, r, COLUMN_COUNT, text, opts)
    cell.font = font(opts.bold, opts.size ?? 11)
  }
  const boxed = (r: number, c: number, value: string | number, o: { bold?: boolean; align: 'left' | 'center' }) => {
    const cell = sheet.getCell(r, c)
    cell.value = value
    cell.font = font(o.bold)
    cell.alignment = { vertical: 'middle', horizontal: o.align, wrapText: true }
    cell.border = BORDER_ALL
  }

  let r = 1
  for (const text of data.headerLines) line(r++, text, { bold: true, align: 'center' })
  r++

  if (data.groups.length === 0) {
    line(r, 'Belum ada pengawas yang ditugaskan.', { align: 'center' })
    return new Uint8Array(await workbook.xlsx.writeBuffer())
  }

  // Summary: NO | NAMA PENGAWAS | STATUS | JUMLAH, in the first four columns of the sheet.
  ;['NO', 'NAMA PENGAWAS', 'STATUS', 'JUMLAH'].forEach((label, i) => boxed(r, i + 1, label, { bold: true, align: 'center' }))
  sheet.getRow(r++).height = MIN_ROW_HEIGHT
  data.groups.forEach((g, i) => {
    boxed(r, 1, i + 1, { align: 'center' })
    boxed(r, 2, g.nama.toUpperCase(), { align: 'left' })
    boxed(r, 3, g.kind === 'dosen' ? 'DOSEN' : 'NON-DOSEN', { align: 'center' })
    boxed(r, 4, g.jumlah, { align: 'center' })
    sheet.getRow(r).height = Math.max(MIN_ROW_HEIGHT, estimateLines(g.nama, WIDTHS[1]) * LINE)
    r++
  })
  boxed(r, 1, 'TOTAL', { bold: true, align: 'center' })
  sheet.mergeCells(r, 1, r, 3)
  boxed(r, 4, data.totalTugas, { bold: true, align: 'center' })
  sheet.getRow(r++).height = MIN_ROW_HEIGHT
  line(r++, 'JUMLAH menghitung ujian Offline dan Ujian Lisan; Online, Take Home dan Project tetap dicantumkan di bawah.', { size: 9 })
  r++

  // Detail: every assignment, the person's NO and NAMA merged down their rows.
  const detailHeader = r
  DETAIL.forEach((label, i) => boxed(r, i + 1, label, { bold: true, align: 'center' }))
  sheet.getRow(r++).height = MIN_ROW_HEIGHT
  data.groups.forEach((g, gi) => {
    const top = r
    g.rows.forEach((row) => {
      const values = ['', '', row.hari, row.tanggal, row.jam, row.kode_mk, row.nama_mk, row.kelas, row.program, row.ruangan, row.keterangan]
      values.slice(2).forEach((value, i) => boxed(r, i + 3, value, { align: LEFT.has(i + 2) ? 'left' : 'center' }))
      sheet.getRow(r).height = Math.max(MIN_ROW_HEIGHT, ...values.map((v, i) => (i >= 2 ? estimateLines(v, WIDTHS[i]) * LINE : 0)))
      r++
    })
    boxed(top, 1, gi + 1, { align: 'center' })
    boxed(top, 2, g.nama.toUpperCase(), { bold: true, align: 'left' })
    // Style first, merge second: exceljs copies the master's style to the covered cells.
    if (g.rows.length > 1) {
      sheet.mergeCells(top, 1, r - 1, 1)
      sheet.mergeCells(top, 2, r - 1, 2)
    }
  })

  const signature = (row: number, text: string, bold: boolean) => {
    sheet.mergeCells(row, SIGNATURE_FROM, row, SIGNATURE_TO)
    const cell = sheet.getCell(row, SIGNATURE_FROM)
    cell.value = text
    cell.font = font(bold)
    cell.alignment = { horizontal: 'center' }
  }
  r += 2
  signature(r, data.jabatanPenandatangan, false)
  r += 5
  signature(r, data.namaPenandatangan, true)

  // The detail header repeats on pages after the one it sits on (Excel's "Print Titles").
  sheet.pageSetup.printTitlesRow = `${detailHeader}:${detailHeader}`
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}
