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
  Packer,
} from 'docx'
import { lecturerDisplayName } from '@/lib/import/tables'
import { HARI_DB } from '@/lib/hari'
import { LOGO_UP_PNG_BASE64 } from './logo-up'
import { FOOTER_BANNER_PNG_BASE64 } from './footer-banner'
import type { ScheduleRow, Lecturer } from '../penjadwalan-types'

const hariIndex = (h: string) => (HARI_DB as readonly string[]).indexOf(h)
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
  return new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 18, type: WidthType.PERCENTAGE },
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
                width: { size: 82, type: WidthType.PERCENTAGE },
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
  const nomorRow = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, borders: NO_BORDERS, children: [textParagraph(`Nomor: ${data.nomorSurat}`)] }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            children: [textParagraph(`${data.kota}, ${tanggal}`, { align: AlignmentType.RIGHT })],
          }),
        ],
      }),
    ],
  })

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [500, 3200, 500, 900, 1400, 700, 900],
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
            margin: { top: '1.5cm', bottom: '1.5cm', left: '2.5cm', right: '2cm', header: '1cm', footer: '0.8cm' },
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
