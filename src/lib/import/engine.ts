import ExcelJS from 'exceljs'

export type ParsedRow = Record<string, unknown>

/** A cell as a plain value: formulas give their result, rich text and links their text. */
function plain(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value !== 'object') return value
  if ('richText' in value) return value.richText.map((r) => r.text).join('')
  if ('formula' in value || 'sharedFormula' in value) return plain((value as ExcelJS.CellFormulaValue).result ?? '')
  if ('text' in value) return plain(value.text as ExcelJS.CellValue)
  if ('error' in value) return ''
  return ''
}

/** Reads the first sheet of an uploaded workbook into row objects keyed by header. */
export async function parseWorkbookRows(buffer: ArrayBuffer): Promise<ParsedRow[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const headers: string[] = []
  sheet.getRow(1).eachCell((cell, col) => (headers[col] = String(plain(cell.value)).trim()))

  const rows: ParsedRow[] = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    // A null prototype: a "__proto__" header is just a key, never Object.prototype.
    const out: ParsedRow = Object.create(null)
    headers.forEach((h, col) => h && (out[h] = plain(row.getCell(col).value)))
    if (Object.values(out).some((v) => v !== '')) rows.push({ ...out })
  })
  return rows
}

async function writeSheet(name: string, rows: unknown[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.addWorksheet(name).addRows(rows)
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

/** Builds a downloadable .xlsx template: header row + one example row. */
export function buildTemplateBuffer(headers: string[], exampleRow: Record<string, string | number>): Promise<Buffer> {
  return writeSheet('Template', [headers, headers.map((h) => exampleRow[h] ?? '')])
}

/** Builds a downloadable .xlsx of the current DB rows — column names match import headers, so it re-uploads cleanly. */
export function buildExportBuffer(rows: Record<string, unknown>[]): Promise<Buffer> {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  return writeSheet('Data', [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))])
}

export type RowOutcome<T> =
  | { status: 'new'; key: string; data: T; notes: string[] }
  | { status: 'changed'; key: string; data: T; notes: string[]; before: T }
  | { status: 'unchanged'; key: string; data: T; notes: string[] }
  | { status: 'rejected'; key: string; reason: string; rowNumber: number }

export type ImportPreview<T> = {
  rows: RowOutcome<T>[]
  counts: { new: number; changed: number; unchanged: number; rejected: number }
}

/**
 * Classifies parsed rows against existing DB rows (by key) into
 * new / changed / unchanged / rejected. `equal` compares two data records
 * field-by-field so unrelated column order never triggers a false "changed".
 */
export function classifyRows<T extends Record<string, unknown>>(params: {
  parsed: ParsedRow[]
  parseRow: (raw: ParsedRow, rowNumber: number) => { key: string; data: T; notes: string[] } | { reason: string }
  existingByKey: Map<string, T>
  equal: (a: T, b: T) => boolean
  /** Keys owned by another prodi: never overwritten from this prodi's import. */
  otherProdiKeys?: Set<string>
}): ImportPreview<T> {
  const { parsed, parseRow, existingByKey, equal } = params
  const outcomes: RowOutcome<T>[] = []
  const seenKeys = new Set<string>()

  parsed.forEach((raw, i) => {
    const rowNumber = i + 2 // header is row 1
    const parsedResult = parseRow(raw, rowNumber)
    if ('reason' in parsedResult) {
      outcomes.push({ status: 'rejected', key: `#${rowNumber}`, reason: parsedResult.reason, rowNumber })
      return
    }
    const { key, data, notes } = parsedResult
    if (seenKeys.has(key)) {
      outcomes.push({ status: 'rejected', key, reason: `Duplicate key "${key}" within this file.`, rowNumber })
      return
    }
    if (params.otherProdiKeys?.has(key)) {
      outcomes.push({ status: 'rejected', key, reason: `"${key}" sudah terdaftar di prodi lain.`, rowNumber })
      return
    }
    seenKeys.add(key)

    const before = existingByKey.get(key)
    if (!before) {
      outcomes.push({ status: 'new', key, data, notes })
    } else if (!equal(before, data)) {
      outcomes.push({ status: 'changed', key, data, notes, before })
    } else {
      outcomes.push({ status: 'unchanged', key, data, notes })
    }
  })

  const counts = { new: 0, changed: 0, unchanged: 0, rejected: 0 }
  for (const o of outcomes) counts[o.status]++

  return { rows: outcomes, counts }
}
