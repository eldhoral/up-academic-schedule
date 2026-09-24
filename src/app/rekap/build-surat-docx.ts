import {
  Document,
  Header,
  Footer,
  Paragraph,
  TextRun,
  ImageRun,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  VerticalAlign,
  Tab,
  TabStopType,
  Packer,
} from 'docx'
import { lecturerDisplayName } from '@/lib/import/tables'
import { HARI_DB } from '@/lib/hari'
import { LOGO_UP_PNG_BASE64 } from './logo-up'
import { FOOTER_BANNER_PNG_BASE64 } from './footer-banner'
import type { ScheduleRow, Lecturer } from '../penjadwalan-types'

const hariIndex = (h: string) => (HARI_DB as readonly string[]).indexOf(h)

// A4 in twips (1440 per inch), with 2.5cm side margins -> matches the
// reference's usable content width. Percentage-based table widths turned
// out not to resolve reliably in Word/QuickLook (only docx-preview's more
// lenient renderer tolerated them) -- every table here uses explicit DXA
// (twip) widths instead, verified against a real docx-compatible renderer.
const PAGE_WIDTH_DXA = 11906
const PAGE_MARGIN_DXA = 1417
const CONTENT_WIDTH_DXA = PAGE_WIDTH_DXA - PAGE_MARGIN_DXA * 2
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER }
const CELL_BORDER = { style: BorderStyle.SINGLE, size: 2, color: '000000' }
const ALL_CELL_BORDERS = { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER }

const DOCX_IMAGE_TYPES: Record<string, 'png' | 'jpg' | 'gif' | 'bmp'> = {
  png: 'png',
  jpeg: 'jpg',
  jpg: 'jpg',
  gif: 'gif',
  bmp: 'bmp',
}

/** Parses a "data:image/png;base64,..." string from the settings' image upload field. */
function parseImageDataUri(dataUri: string): { type: 'png' | 'jpg' | 'gif' | 'bmp'; data: Buffer } | null {
  const match = /^data:image\/(\w+);base64,(.+)$/.exec(dataUri)
  if (!match) return null
  const type = DOCX_IMAGE_TYPES[match[1].toLowerCase()]
  if (!type) return null
  return { type, data: Buffer.from(match[2], 'base64') }
}

function sortByHariJam(rows: ScheduleRow[]): ScheduleRow[] {
  return [...rows].sort((a, b) => hariIndex(a.hari) - hariIndex(b.hari) || a.jam_mulai.localeCompare(b.jam_mulai))
}

function textParagraph(text: string, opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({ alignment: opts.align, children: [new TextRun({ text, bold: opts.bold ?? false })] })
}

function cell(text: string, opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new TableCell({
    borders: ALL_CELL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: [textParagraph(text, { bold: opts.bold, align: opts.align ?? AlignmentType.LEFT })],
  })
}

function tableSection(title: string, rows: ScheduleRow[]) {
  const banner = new TableRow({
    children: [
      new TableCell({
        columnSpan: 7,
        borders: ALL_CELL_BORDERS,
        margins: { top: 40, bottom: 40, left: 60, right: 60 },
        children: [textParagraph(title, { bold: true })],
      }),
    ],
  })

  if (rows.length === 0) {
    return [
      banner,
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 7,
            borders: ALL_CELL_BORDERS,
            margins: { top: 40, bottom: 40, left: 60, right: 60 },
            children: [textParagraph('—', { align: AlignmentType.CENTER })],
          }),
        ],
      }),
    ]
  }

  const dataRows = sortByHariJam(rows).map(
    (r, i) =>
      new TableRow({
        children: [
          cell(String(i + 1), { align: AlignmentType.CENTER }),
          cell(r.courses?.nama_mk ?? r.kode_mk),
          cell(String(r.courses?.sks ?? ''), { align: AlignmentType.CENTER }),
          cell(r.hari, { align: AlignmentType.CENTER }),
          cell(`${r.jam_mulai.slice(0, 5)} - ${r.jam_selesai.slice(0, 5)}`, { align: AlignmentType.CENTER }),
          cell(r.kelas, { align: AlignmentType.CENTER }),
          cell(r.rooms?.nama ?? '', { align: AlignmentType.CENTER }),
        ],
      }),
  )
  return [banner, ...dataRows]
}

function buildHeader(kopLines: string[]): Header {
  const logo = Buffer.from(LOGO_UP_PNG_BASE64, 'base64')
  const logoColWidth = Math.round(CONTENT_WIDTH_DXA * 0.13)
  const textColWidth = CONTENT_WIDTH_DXA - logoColWidth
  return new Header({
    children: [
      new Table({
        width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
        columnWidths: [logoColWidth, textColWidth],
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                borders: NO_BORDERS,
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new ImageRun({ type: 'png', data: logo, transformation: { width: 80, height: 80 } })],
                  }),
                ],
              }),
              new TableCell({
                verticalAlign: VerticalAlign.CENTER,
                borders: NO_BORDERS,
                children: kopLines.map(
                  (line, i) =>
                    new Paragraph({
                      spacing: { after: 0 },
                      children: [new TextRun({ text: line, bold: i === 0, size: i === 0 ? 32 : 22, font: i === 0 ? 'Ebrima' : undefined })],
                    }),
                ),
              }),
            ],
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000' } },
        children: [],
      }),
    ],
  })
}

function buildFooter(): Footer {
  const banner = Buffer.from(FOOTER_BANNER_PNG_BASE64, 'base64')
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: 'png', data: banner, transformation: { width: 500, height: 43 } })],
      }),
    ],
  })
}

function buildLetterParagraphs(
  lecturer: Lecturer,
  rows: ScheduleRow[],
  data: {
    kota: string
    namaFakultas: string
    term: string
    tahun: string
    nomorSurat: string
    lampiranSurat: string
    perihalSurat: string
    catatanPerkuliahan: string
    namaDekan: string
    jabatanDekan: string
    gambarTandaTanganDekan: string
  },
  tanggal: string,
): (Paragraph | Table)[] {
  const signatureImage = data.gambarTandaTanganDekan ? parseImageDataUri(data.gambarTandaTanganDekan) : null
  // A right tab stop at the page's right margin, rather than a borderless
  // table -- more reliably supported across docx renderers for a simple
  // "left text ... right text" line.
  const nomorRow = new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH_DXA }],
    children: [new TextRun(`Nomor: ${data.nomorSurat}`), new TextRun({ children: [new Tab()] }), new TextRun(`${data.kota}, ${tanggal}`)],
  })

  const table = new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [500, 4172, 500, 900, 1400, 700, 900],
    rows: [
      new TableRow({
        children: [
          cell('NO.', { bold: true, align: AlignmentType.CENTER }),
          cell('MATA KULIAH', { bold: true, align: AlignmentType.CENTER }),
          cell('SKS', { bold: true, align: AlignmentType.CENTER }),
          cell('HARI', { bold: true, align: AlignmentType.CENTER }),
          cell('JAM', { bold: true, align: AlignmentType.CENTER }),
          cell('KELAS', { bold: true, align: AlignmentType.CENTER }),
          cell('RUANG', { bold: true, align: AlignmentType.CENTER }),
        ],
      }),
      ...tableSection('Kelas Reguler', rows.filter((s) => s.jenis_kelas === 'reguler')),
      ...tableSection('Kelas Reguler Khusus', rows.filter((s) => s.jenis_kelas === 'regsus')),
    ],
  })

  return [
    nomorRow,
    textParagraph(`Lampiran: ${data.lampiranSurat}`),
    textParagraph(`Perihal: ${data.perihalSurat}`),
    textParagraph(''),
    textParagraph('Kepada Yth.'),
    textParagraph(`Bapak/Ibu/Sdr. ${lecturerDisplayName(lecturer)}`),
    textParagraph(`Dosen ${data.namaFakultas}`),
    textParagraph('Universitas Pancasila'),
    textParagraph('Di Tempat'),
    textParagraph(''),
    textParagraph('Dengan hormat,'),
    textParagraph(''),
    textParagraph(`Berikut disampaikan jadwal mengajar Bapak/Ibu/Sdr. pada Semester ${data.term} Tahun Akademik ${data.tahun} :`),
    table,
    textParagraph(''),
    textParagraph(data.catatanPerkuliahan),
    textParagraph(''),
    textParagraph('Demikian agar menjadi perhatian.'),
    textParagraph(''),
    textParagraph(''),
    new Paragraph({ indent: { left: 5000 }, children: [new TextRun({ text: data.jabatanDekan })] }),
    signatureImage
      ? new Paragraph({
          indent: { left: 5000 },
          children: [new ImageRun({ type: signatureImage.type, data: signatureImage.data, transformation: { width: 120, height: 60 } })],
        })
      : textParagraph(''),
    textParagraph(''),
    textParagraph(''),
    new Paragraph({
      indent: { left: 5000 },
      children: [new TextRun({ text: data.namaDekan, bold: true, underline: {} })],
    }),
  ]
}

export async function buildSuratDocx(data: {
  lecturersToRender: Lecturer[]
  byDosen: Map<string, ScheduleRow[]>
  kota: string
  namaFakultas: string
  term: string
  tahun: string
  kopLines: string[]
  nomorSurat: string
  lampiranSurat: string
  perihalSurat: string
  catatanPerkuliahan: string
  namaDekan: string
  jabatanDekan: string
  gambarTandaTanganDekan: string
  tembusanLines: string[]
}): Promise<Uint8Array<ArrayBuffer>> {
  const tanggal = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const header = buildHeader(data.kopLines)
  const footer = buildFooter()

  const children: (Paragraph | Table)[] = []

  if (data.lecturersToRender.length === 0) {
    children.push(textParagraph('Tidak ada data mengajar untuk pilihan ini.', { align: AlignmentType.CENTER }))
  }

  data.lecturersToRender.forEach((lecturer, index) => {
    if (index > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
    }
    const rows = data.byDosen.get(lecturer.kode_dosen) ?? []
    children.push(...buildLetterParagraphs(lecturer, rows, data, tanggal))
    children.push(textParagraph(''))
    children.push(textParagraph('Tembusan Kepada Yth.:'))
    for (const line of data.tembusanLines) children.push(textParagraph(line))
  })

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH_DXA, height: 16838 },
            margin: { top: 850, bottom: 850, left: PAGE_MARGIN_DXA, right: PAGE_MARGIN_DXA, header: 567, footer: 454 },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children,
      },
    ],
  })

  return Packer.toArrayBuffer(doc).then((buf) => new Uint8Array(buf))
}
