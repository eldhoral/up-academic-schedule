import {
  Document,
  Header,
  Footer,
  Paragraph,
  TextRun,
  ImageRun,
  ExternalHyperlink,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  VerticalAlign,
  HeightRule,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  LevelFormat,
  Tab,
  TabStopType,
  Packer,
  type ParagraphChild,
  type IRunOptions,
} from 'docx'
import { lecturerDisplayName } from '@/lib/import/tables'
import { HARI_DB } from '@/lib/hari'
import { LOGO_UP_PNG_BASE64 } from './logo-up'
import { FOOTER_BANNER_PNG_BASE64 } from './footer-banner'
import type { ScheduleRow, Lecturer } from '../penjadwalan-types'

// Every measurement below is copied from the faculty's reference,
// docs/Draft Surat Penugasan Pengampu Dosen MK Gasal 26-27.docx (its
// document.xml / header1.xml / footer1.xml): Letter page, Arial 11pt body,
// tab stops, table grid, border styles, row heights, image extents.
// Twips (1/1440 in) for layout; EMU (914400/in) for floating image offsets.
const EMU_PER_PX = 9525

const PAGE = { width: 12240, height: 15840 } // Letter
const MARGIN = { top: 709, right: 1440, bottom: 0, left: 1440, header: 720, footer: 720 }
const BODY_TABS = [
  { type: TabStopType.LEFT, position: 993 },
  { type: TabStopType.LEFT, position: 1134 },
  { type: TabStopType.LEFT, position: 6521 },
]
const TABLE_WIDTH = 9453
// BOR ZOOM's width comes out of MATA KULIAH, SKS and HARI so the total stays TABLE_WIDTH.
const TABLE_GRID = [608, 2321, 700, 1000, 1394, 989, 1041, 1400]
const HYPERLINK_COLOR = '0563C1'
// Fonts go on every run, as in the reference: QuickLook/Pages ignore docDefaults.
// The kop's address lines use the theme's minorBidi font, which Word resolves to Times New Roman.
const KOP_FONT = 'Times New Roman'

const run = (o: string | IRunOptions) => new TextRun({ font: 'Arial', ...(typeof o === 'string' ? { text: o } : o) })

const hariIndex = (h: string) => (HARI_DB as readonly string[]).indexOf(h)
const SINGLE = { style: BorderStyle.SINGLE, size: 4, color: 'auto' }
const THIN_THICK = { style: BorderStyle.THIN_THICK_SMALL_GAP, size: 24, color: 'auto' }
const THICK_THIN = { style: BorderStyle.THICK_THIN_SMALL_GAP, size: 24, color: 'auto' }

const DOCX_IMAGE_TYPES: Record<string, 'png' | 'jpg' | 'gif' | 'bmp'> = { png: 'png', jpeg: 'jpg', jpg: 'jpg', gif: 'gif', bmp: 'bmp' }

/** Parses a "data:image/png;base64,..." string from the settings' image upload field. */
function parseImageDataUri(dataUri: string): { type: 'png' | 'jpg' | 'gif' | 'bmp'; data: Buffer } | null {
  const match = /^data:image\/(\w+);base64,(.+)$/.exec(dataUri)
  if (!match) return null
  const type = DOCX_IMAGE_TYPES[match[1].toLowerCase()]
  if (!type) return null
  return { type, data: Buffer.from(match[2], 'base64') }
}

/** "PENGEMBANGAN DIRI DAN KARIER" -> "Pengembangan Diri Dan Karier", keeping roman numerals ("STATISTIKA II" -> "Statistika II"). */
function titleCase(text: string): string {
  return text
    .split(/(\s+)/)
    .map((w) => (/^[IVXLC]+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('')
}

function sortByHariJam(rows: ScheduleRow[]): ScheduleRow[] {
  return [...rows].sort((a, b) => hariIndex(a.hari) - hariIndex(b.hari) || a.jam_mulai.localeCompare(b.jam_mulai))
}

function bodyParagraph(
  children: ParagraphChild[] | string,
  opts: { bold?: boolean; justify?: boolean; indentLeft?: number; pageBreakBefore?: boolean } = {},
) {
  return new Paragraph({
    tabStops: BODY_TABS,
    pageBreakBefore: opts.pageBreakBefore,
    alignment: opts.justify ? AlignmentType.JUSTIFIED : undefined,
    indent: opts.indentLeft ? { left: opts.indentLeft } : undefined,
    children: typeof children === 'string' ? [run({ text: children, bold: opts.bold })] : children,
  })
}

const tab = () => run({ children: [new Tab()] })

function tableCell(text: string, opts: { bold?: boolean; center?: boolean; span?: number; width: number; borders?: object }) {
  return new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    columnSpan: opts.span,
    verticalAlign: VerticalAlign.CENTER,
    borders: opts.borders,
    children: [
      new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : undefined,
        children: [run({ text, bold: opts.bold })],
      }),
    ],
  })
}

function buildTable(rows: ScheduleRow[]): Table {
  const thickEdges = { top: THIN_THICK, bottom: THICK_THIN }
  const header = new TableRow({
    height: { value: 580, rule: HeightRule.ATLEAST },
    children: ['NO.', 'MATA KULIAH', 'SKS', 'HARI', 'JAM', 'KELAS', 'RUANG', 'BOR ZOOM'].map((label, i) =>
      tableCell(label, { bold: true, center: true, width: TABLE_GRID[i], borders: thickEdges }),
    ),
  })

  const section = (title: string, list: ScheduleRow[], first: boolean) => {
    const banner = new TableRow({
      height: { value: first ? 580 : 504, rule: HeightRule.ATLEAST },
      children: [tableCell(title, { bold: true, span: TABLE_GRID.length, width: TABLE_WIDTH, borders: first ? thickEdges : undefined })],
    })
    if (list.length === 0) {
      return [
        banner,
        new TableRow({
          height: { value: 504, rule: HeightRule.ATLEAST },
          children: [tableCell('—', { center: true, span: TABLE_GRID.length, width: TABLE_WIDTH })],
        }),
      ]
    }
    const data = sortByHariJam(list).map(
      (r, i) =>
        new TableRow({
          height: { value: 504, rule: HeightRule.ATLEAST },
          children: [
            tableCell(`${i + 1}.`, { center: true, width: TABLE_GRID[0] }),
            tableCell(titleCase(r.courses?.nama_mk ?? r.kode_mk), { width: TABLE_GRID[1] }),
            tableCell(String(r.courses?.sks ?? ''), { center: true, width: TABLE_GRID[2] }),
            tableCell(titleCase(r.hari), { center: true, width: TABLE_GRID[3] }),
            tableCell(`${r.jam_mulai.slice(0, 5)}-${r.jam_selesai.slice(0, 5)}`.replace(/:/g, '.'), { center: true, width: TABLE_GRID[4] }),
            tableCell(r.kelas, { center: true, width: TABLE_GRID[5] }),
            tableCell(r.rooms?.nama ?? '', { center: true, width: TABLE_GRID[6] }),
            tableCell(r.zoom_id || '', { center: true, width: TABLE_GRID[7] }),
          ],
        }),
    )
    return [banner, ...data]
  }

  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: TABLE_GRID,
    borders: { top: THIN_THICK, left: THIN_THICK, bottom: THICK_THIN, right: THICK_THIN, insideHorizontal: SINGLE, insideVertical: SINGLE },
    rows: [
      header,
      ...section('Kelas Reguler', rows.filter((s) => s.jenis_kelas === 'reguler'), true),
      ...section('Kelas Reguler Khusus', rows.filter((s) => s.jenis_kelas === 'regsus'), false),
    ],
  })
}

/** Splits a kop line into text + blue underlined hyperlinks for any URL or email in it. */
function kopLineRuns(line: string): ParagraphChild[] {
  const runs: ParagraphChild[] = []
  const pattern = /(https?:\/\/\S+|[\w.+-]+@[\w-]+\.[\w.]+)/g
  let last = 0
  for (const match of line.matchAll(pattern)) {
    const at = match.index ?? 0
    if (at > last) runs.push(new TextRun({ text: line.slice(last, at), size: 24, font: KOP_FONT }))
    const target = match[0]
    runs.push(
      new ExternalHyperlink({
        link: target.includes('@') && !target.startsWith('http') ? `mailto:${target}` : target,
        children: [new TextRun({ text: target, size: 24, font: KOP_FONT, color: HYPERLINK_COLOR, underline: {} })],
      }),
    )
    last = at + target.length
  }
  if (last < line.length) runs.push(new TextRun({ text: line.slice(last), size: 24, font: KOP_FONT }))
  return runs
}

function buildHeader(kopLines: string[]): Header {
  const [title = '', ...rest] = kopLines
  const logo = new ImageRun({
    type: 'png',
    data: Buffer.from(LOGO_UP_PNG_BASE64, 'base64'),
    transformation: { width: Math.round(1951812 / EMU_PER_PX), height: Math.round(1238013 / EMU_PER_PX) },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.COLUMN, offset: -1042035 },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: -119380 },
      behindDocument: true,
      wrap: { type: TextWrappingType.NONE },
    },
  })
  return new Header({
    children: [
      new Paragraph({
        indent: { firstLine: 851, right: -710 },
        children: [logo, new TextRun({ text: title, font: 'Ebrima', size: 36, bold: true })],
      }),
      ...rest.map((line) => new Paragraph({ indent: { left: 851, right: -1135 }, children: kopLineRuns(line) })),
      // The reference draws a 3pt, 18.1cm-wide line shape under the kop; a
      // paragraph border widened past the margins renders the same in every
      // docx viewer, unlike a floating shape.
      new Paragraph({
        indent: { left: -454, right: -454 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: '000000', space: 1 } },
        children: [],
      }),
    ],
  })
}

function buildFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          new ImageRun({
            type: 'png',
            data: Buffer.from(FOOTER_BANNER_PNG_BASE64, 'base64'),
            transformation: { width: Math.round(7444001 / EMU_PER_PX), height: Math.round(638132 / EMU_PER_PX) },
            floating: {
              horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, offset: -723900 },
              verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: 0 },
              behindDocument: true,
              wrap: { type: TextWrappingType.NONE },
            },
          }),
        ],
      }),
    ],
  })
}

type LetterData = {
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
  tembusanLines: string[]
}

function buildLetter(lecturer: Lecturer, rows: ScheduleRow[], data: LetterData, tanggal: string, letterIndex: number, newPage: boolean): (Paragraph | Table)[] {
  const signature = data.gambarTandaTanganDekan ? parseImageDataUri(data.gambarTandaTanganDekan) : null
  const text = run

  return [
    bodyParagraph([text('Nomor'), tab(), text(':'), tab(), text(data.nomorSurat), tab(), text(`${data.kota}, ${tanggal}`)], {
      pageBreakBefore: newPage,
    }),
    bodyParagraph([text('Lampiran'), tab(), text(':'), tab(), text(data.lampiranSurat)]),
    bodyParagraph([text('Perihal'), tab(), text(':'), tab(), text(data.perihalSurat)]),
    bodyParagraph(''),
    bodyParagraph('Kepada Yth.'),
    bodyParagraph([text('Bapak/Ibu/Sdr. '), run({ text: lecturerDisplayName(lecturer), bold: true })]),
    bodyParagraph(`Dosen ${data.namaFakultas}`),
    bodyParagraph('Universitas Pancasila'),
    bodyParagraph('Di Tempat'),
    bodyParagraph(''),
    bodyParagraph('Dengan hormat,'),
    bodyParagraph(''),
    bodyParagraph(`Berikut disampaikan jadwal mengajar Bapak/Ibu/Sdr. pada Semester ${titleCase(data.term)} Tahun Akademik ${data.tahun} :`),
    buildTable(rows),
    bodyParagraph(data.catatanPerkuliahan, { bold: true }),
    bodyParagraph('Demikian agar menjadi perhatian.', { justify: true }),
    bodyParagraph(data.jabatanDekan, { justify: true, indentLeft: 5670 }),
    bodyParagraph('', { justify: true, indentLeft: 5670 }),
    bodyParagraph('', { justify: true, indentLeft: 5670 }),
    signature
      ? bodyParagraph([new ImageRun({ type: signature.type, data: signature.data, transformation: { width: 120, height: 60 } })], {
          justify: true,
          indentLeft: 5670,
        })
      : bodyParagraph('', { justify: true, indentLeft: 5670 }),
    new Paragraph({
      tabStops: BODY_TABS,
      alignment: AlignmentType.JUSTIFIED,
      indent: { left: 5245, right: -421 },
      children: [run({ text: data.namaDekan, bold: true })],
    }),
    bodyParagraph('', { justify: true }),
    bodyParagraph('Tembusan Kepada Yth.:', { justify: true }),
    ...data.tembusanLines.map(
      (line) =>
        new Paragraph({
          tabStops: BODY_TABS,
          alignment: AlignmentType.JUSTIFIED,
          numbering: { reference: 'tembusan', level: 0, instance: letterIndex },
          children: [run(line)],
        }),
    ),
  ]
}

export async function buildSuratDocx(data: LetterData & { lecturersToRender: Lecturer[]; byDosen: Map<string, ScheduleRow[]>; kopLines: string[] }): Promise<
  Uint8Array<ArrayBuffer>
> {
  const tanggal = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const children: (Paragraph | Table)[] = []

  if (data.lecturersToRender.length === 0) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run('Tidak ada data mengajar untuk pilihan ini.')] }))
  }

  data.lecturersToRender.forEach((lecturer, index) => {
    const letter = buildLetter(lecturer, data.byDosen.get(lecturer.kode_dosen) ?? [], data, tanggal, index, index > 0)
    children.push(...letter)
  })

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22 },
          paragraph: { spacing: { after: 0, line: 259 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: 'tembusan',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: { page: { size: PAGE, margin: MARGIN } },
        headers: { default: buildHeader(data.kopLines) },
        footers: { default: buildFooter() },
        children,
      },
    ],
  })

  return Packer.toArrayBuffer(doc).then((buf) => new Uint8Array(buf))
}
