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
// document.xml / header1.xml / footer1.xml): Arial 11pt body, tab stops, border
// styles, row heights, image extents. The page is A4 (the draft was Letter), so
// the table grid is narrowed to A4's text width.
// Twips (1/1440 in) for layout; EMU (914400/in) for floating image offsets.
const EMU_PER_PX = 9525

const PAGE = { width: 11906, height: 16838 } // A4
const MARGIN = { top: 709, right: 1440, bottom: 0, left: 1440, header: 720, footer: 720 }
const BODY_TABS = [
  { type: TabStopType.LEFT, position: 993 },
  { type: TabStopType.LEFT, position: 1134 },
  { type: TabStopType.LEFT, position: 6521 - (9360 - 9026) }, // the draft's date tab, moved left by Letter-to-A4 text width
]
const TEXT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right
const TABLE_GRID = [608, 1994, 700, 1000, 1394, 989, 1041, 1300]
const TABLE_WIDTH = TEXT_WIDTH
const TABLE_HEADER = ['NO.', 'MATA KULIAH', 'SKS', 'HARI', 'JAM', 'KELAS', 'RUANG', 'BOR ZOOM']
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
  opts: { bold?: boolean; justify?: boolean; indentLeft?: number; pageBreakBefore?: boolean; before?: number; after?: number } = {},
) {
  return new Paragraph({
    tabStops: BODY_TABS,
    pageBreakBefore: opts.pageBreakBefore,
    spacing: opts.before || opts.after ? { before: opts.before, after: opts.after } : undefined,
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

type Section = { title: string; rows: ScheduleRow[] }
type TotalRow = { label: string; sks: number }

const sumSks = (rows: ScheduleRow[]) => rows.reduce((sum, r) => sum + (r.courses?.sks ?? 0), 0)

function rowTexts(r: ScheduleRow, i: number): string[] {
  return [
    `${i + 1}.`,
    titleCase(r.courses?.nama_mk ?? r.kode_mk),
    String(r.courses?.sks ?? ''),
    titleCase(r.hari),
    `${r.jam_mulai.slice(0, 5)}-${r.jam_selesai.slice(0, 5)}`.replace(/:/g, '.'),
    r.kelas,
    r.rooms?.nama ?? '',
    r.zoom_id || '',
  ]
}

function buildTable(sections: Section[], totals: TotalRow[]): Table {
  const thickEdges = { top: THIN_THICK, bottom: THICK_THIN }
  const header = new TableRow({
    height: { value: 580, rule: HeightRule.ATLEAST },
    children: TABLE_HEADER.map((label, i) => tableCell(label, { bold: true, center: true, width: TABLE_GRID[i], borders: thickEdges })),
  })

  const section = ({ title, rows: list }: Section, first: boolean) => {
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
          children: rowTexts(r, i).map((text, col) => tableCell(text, { center: col !== 1, width: TABLE_GRID[col] })),
        }),
    )
    return [banner, ...data]
  }

  const totalRow = ({ label, sks }: TotalRow) =>
    new TableRow({
      height: { value: 504, rule: HeightRule.ATLEAST },
      children: [
        tableCell(label, { bold: true, center: true, span: 2, width: TABLE_GRID[0] + TABLE_GRID[1] }),
        tableCell(String(sks), { bold: true, center: true, width: TABLE_GRID[2] }),
        tableCell('', { span: TABLE_GRID.length - 3, width: TABLE_GRID.slice(3).reduce((sum, w) => sum + w, 0) }),
      ],
    })

  return new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: TABLE_GRID,
    borders: { top: THIN_THICK, left: THIN_THICK, bottom: THICK_THIN, right: THICK_THIN, insideHorizontal: SINGLE, insideVertical: SINGLE },
    rows: [header, ...sections.flatMap((sec, i) => section(sec, i === 0)), ...totals.map(totalRow)],
  })
}

// --- One-page fit estimate --------------------------------------------------
// docx has no layout engine, so whether a letter fits on one page is predicted
// from text wrapping. ponytail: rough Arial glyph widths; FIT_SAFETY absorbs the
// error, and a wrong guess only means an unneeded split or a natural page flow.
const LINE = 273 // one Arial 11pt line at the 259 line spacing, in twips
const CELL_PADDING = 216 // Word's default 108-twip left + right cell margins
const FIT_SAFETY = 0.95
const TABLE_GAP = 240 // space between the table and the paragraphs above/below it
const SIGNATURE_LINES = 5 // blank lines (or the image) between jabatan and nama dekan

/** Approximate width in twips of `text` in Arial 11pt. */
function textWidth(text: string, bold = false): number {
  let em = 0
  for (const ch of text) {
    if (ch === ' ' || /[.,:;il|!'\-]/.test(ch)) em += 0.278
    else if (/[0-9]/.test(ch)) em += 0.556
    else if (/[MW]/.test(ch)) em += 0.85
    else if (/[A-Z]/.test(ch)) em += 0.69
    else if (/[mw]/.test(ch)) em += 0.8
    else em += 0.53
  }
  return em * 220 * (bold ? 1.07 : 1)
}

/** Lines `text` wraps to at `width` twips, breaking at spaces like Word does. */
function lineCount(text: string, width: number, bold = false): number {
  let lines = 1
  let current = 0
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = textWidth(word, bold)
    if (current > 0 && current + textWidth(' ', bold) + w > width) {
      lines++
      current = w
    } else {
      current += (current > 0 ? textWidth(' ', bold) : 0) + w
    }
  }
  return lines
}

const cellLines = (texts: string[], bold = false) =>
  Math.max(...texts.map((t, i) => lineCount(t, TABLE_GRID[i] - CELL_PADDING, bold)))

function tableHeight(sections: Section[], totals: TotalRow[]): number {
  let h = Math.max(580, cellLines(TABLE_HEADER, true) * LINE) + 120 // + the thick double borders
  sections.forEach(({ rows }, i) => {
    h += i === 0 ? 580 : 504
    if (rows.length === 0) h += 504
    rows.forEach((r, j) => (h += Math.max(504, cellLines(rowTexts(r, j)) * LINE)))
  })
  return h + totals.length * 504
}

/** Height of everything but the table in buildLetter, top to bottom. */
function letterTextHeight(data: LetterData, intro: string): number {
  const para = (text: string, width = TEXT_WIDTH, bold = false) => lineCount(text, width, bold) * LINE
  return (
    12 * LINE + // Nomor ... "Dengan hormat," with its blank lines
    para(intro) +
    2 * TABLE_GAP +
    para(data.catatanPerkuliahan, TEXT_WIDTH, true) +
    LINE + // Demikian
    para(data.jabatanDekan, TEXT_WIDTH - 5670) +
    (SIGNATURE_LINES - 1) * LINE +
    (data.gambarTandaTanganDekan ? 900 : LINE) + // 60px signature image
    para(data.namaDekan, TEXT_WIDTH - 5245 + 421, true) +
    2 * LINE + // blank + "Tembusan Kepada Yth.:"
    data.tembusanLines.reduce((sum, line) => sum + para(line, TEXT_WIDTH - 720), 0)
  )
}

/** Usable body height on one page: below the kop header, above the footer. */
function bodyHeight(kopLines: string[]): number {
  // Ebrima 18pt title + Times 12pt address lines + the ruled paragraph under them.
  const header = 478 + 298 * Math.max(0, kopLines.length - 1) + 335
  const top = Math.max(MARGIN.top, MARGIN.header + header)
  const bottom = Math.max(MARGIN.bottom, MARGIN.footer + LINE)
  return PAGE.height - top - bottom
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
              // Centered on the page (EMU = twips * 635).
              horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, offset: Math.round((PAGE.width * 635 - 7444001) / 2 - MARGIN.left * 635) },
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

/** One table when the letter fits on a page; otherwise Reguler on page one and
 *  Reguler Khusus (with the closing) on page two. Splitting only helps when both have rows. */
function buildTables(rows: ScheduleRow[], data: LetterData, intro: string, kopLines: string[]): (Paragraph | Table)[] {
  const reguler = { title: 'Kelas Reguler', rows: rows.filter((s) => s.jenis_kelas === 'reguler') }
  const regsus = { title: 'Kelas Reguler Khusus', rows: rows.filter((s) => s.jenis_kelas === 'regsus') }
  const whole = [reguler, regsus]
  const total = [{ label: 'TOTAL', sks: sumSks(rows) }]

  const fits = letterTextHeight(data, intro) + tableHeight(whole, total) <= bodyHeight(kopLines) * FIT_SAFETY
  if (fits || reguler.rows.length === 0 || regsus.rows.length === 0) return [buildTable(whole, total)]

  return [
    buildTable([reguler], [{ label: 'TOTAL', sks: sumSks(reguler.rows) }]),
    // Also keeps Word from merging the two adjacent tables into one.
    bodyParagraph('', { pageBreakBefore: true }),
    buildTable([regsus], [{ label: 'TOTAL', sks: sumSks(regsus.rows) }, { label: 'TOTAL KESELURUHAN', sks: sumSks(rows) }]),
  ]
}

function buildLetter(
  lecturer: Lecturer,
  rows: ScheduleRow[],
  data: LetterData,
  kopLines: string[],
  tanggal: string,
  letterIndex: number,
  newPage: boolean,
): (Paragraph | Table)[] {
  const signature = data.gambarTandaTanganDekan ? parseImageDataUri(data.gambarTandaTanganDekan) : null
  const text = run
  const intro = `Berikut disampaikan jadwal mengajar Bapak/Ibu/Sdr. pada Semester ${titleCase(data.term)} Tahun Akademik ${data.tahun} :`

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
    bodyParagraph(intro, { after: TABLE_GAP }),
    ...buildTables(rows, data, intro, kopLines),
    bodyParagraph(data.catatanPerkuliahan, { bold: true, before: TABLE_GAP }),
    bodyParagraph('Demikian agar menjadi perhatian.', { justify: true }),
    bodyParagraph(data.jabatanDekan, { justify: true, indentLeft: 5670 }),
    ...Array.from({ length: SIGNATURE_LINES - 1 }, () => bodyParagraph('', { justify: true, indentLeft: 5670 })),
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
    const letter = buildLetter(lecturer, data.byDosen.get(lecturer.kode_dosen) ?? [], data, data.kopLines, tanggal, index, index > 0)
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
