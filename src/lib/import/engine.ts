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

/** Header -> allowed values: that column gets a dropdown, its values listed on a hidden "Pilihan" sheet. */
export type Dropdowns = Record<string, string[]>

// ponytail: the dropdown covers a fixed number of rows; raise it if a bulk file ever passes 1000 rows.
const DROPDOWN_ROWS = 1000

async function writeSheet(name: string, rows: unknown[][], dropdowns: Dropdowns = {}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(name)
  sheet.addRows(rows)
  const headers = (rows[0] ?? []) as string[]
  const lists = Object.entries(dropdowns).filter(([h, values]) => values.length && headers.includes(h))
  if (lists.length) {
    // After the data sheet: the import reads only the first sheet.
    const pilihan = workbook.addWorksheet('Pilihan', { state: 'hidden' })
    const validations = (sheet as unknown as { dataValidations: { add(range: string, v: ExcelJS.DataValidation): void } }).dataValidations
    const last = Math.max(rows.length, DROPDOWN_ROWS)
    lists.forEach(([h, values], i) => {
      const from = pilihan.getColumn(i + 1)
      from.values = [h, ...values]
      const to = sheet.getColumn(headers.indexOf(h) + 1)
      to.width = Math.max(12, ...values.map((v) => v.length + 2))
      validations.add(`${to.letter}2:${to.letter}${last}`, {
        type: 'list',
        allowBlank: true,
        formulae: [`Pilihan!$${from.letter}$2:$${from.letter}$${values.length + 1}`],
        showErrorMessage: true,
        errorStyle: 'stop',
        errorTitle: 'Tidak ada di daftar',
        error: 'Pilih salah satu nilai dari daftar.',
      })
    })
  }
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

/** Builds a downloadable .xlsx template: header row + one example row. */
export function buildTemplateBuffer(headers: string[], exampleRow: Record<string, string | number>, dropdowns?: Dropdowns): Promise<Buffer> {
  return writeSheet('Template', [headers, headers.map((h) => exampleRow[h] ?? '')], dropdowns)
}

/** Builds a downloadable .xlsx of the current DB rows — column names match import headers, so it re-uploads cleanly. */
export function buildExportBuffer(rows: Record<string, unknown>[], dropdowns?: Dropdowns): Promise<Buffer> {
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  return writeSheet('Data', [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))], dropdowns)
}

export type ParsedOkay<T> = { key: string; data: T; notes: string[]; rowNumber: number }
export type CombinedRow<T> = ParsedOkay<T> | { key: string; reason: string; rowNumber: number }

export type RowOutcome<T> =
  | { status: 'new'; key: string; data: T; notes: string[]; rowNumber: number }
  | { status: 'changed'; key: string; data: T; notes: string[]; before: T; rowNumber: number }
  | { status: 'unchanged'; key: string; data: T; notes: string[]; rowNumber: number }
  | { status: 'rejected'; key: string; reason: string; rowNumber: number }

export type ImportPreview<T> = {
  rows: RowOutcome<T>[]
  counts: { new: number; changed: number; unchanged: number; rejected: number }
}

/**
 * Classifies parsed rows against existing DB rows (by key) into
 * new / changed / unchanged / rejected. `equal` compares two data records
 * field-by-field so unrelated column order never triggers a false "changed".
 * An optional `combine` step merges parsed rows (e.g. several kurikulum of one
 * kode_mk) before classification; every outcome keeps its source row number.
 */
export function classifyRows<T extends Record<string, unknown>>(params: {
  parsed: ParsedRow[]
  parseRow: (raw: ParsedRow, rowNumber: number) => { key: string; data: T; notes: string[] } | { reason: string }
  existingByKey: Map<string, T>
  equal: (a: T, b: T) => boolean
  /** Keys owned by another prodi: never overwritten from this prodi's import. */
  otherProdiKeys?: Set<string>
  /** Optional row-level guard: returns a rejection reason, or null to accept the row. */
  reject?: (data: T) => string | null
  /** Optional merge step over all valid rows, before duplicate/other-prodi/reject checks. */
  combine?: (rows: ParsedOkay<T>[], existingByKey: Map<string, T>) => CombinedRow<T>[]
}): ImportPreview<T> {
  const { parsed, parseRow, existingByKey, equal } = params
  const outcomes: RowOutcome<T>[] = []
  const seenKeys = new Set<string>()
  const valid: ParsedOkay<T>[] = []

  parsed.forEach((raw, i) => {
    const rowNumber = i + 2 // header is row 1
    const parsedResult = parseRow(raw, rowNumber)
    if ('reason' in parsedResult) {
      outcomes.push({ status: 'rejected', key: `#${rowNumber}`, reason: parsedResult.reason, rowNumber })
      return
    }
    valid.push({ ...parsedResult, rowNumber })
  })

  const rows: CombinedRow<T>[] = params.combine ? params.combine(valid, existingByKey) : valid

  for (const item of rows) {
    const { key, rowNumber } = item
    if (seenKeys.has(key)) {
      outcomes.push({ status: 'rejected', key, reason: `"${key}" muncul lebih dari sekali di file ini.`, rowNumber })
      continue
    }
    if (params.otherProdiKeys?.has(key)) {
      outcomes.push({ status: 'rejected', key, reason: `"${key}" sudah terdaftar di prodi lain.`, rowNumber })
      continue
    }
    seenKeys.add(key)

    if ('reason' in item) {
      outcomes.push({ status: 'rejected', key, reason: item.reason, rowNumber })
      continue
    }
    const { data, notes } = item
    const rejectReason = params.reject?.(data)
    if (rejectReason) {
      outcomes.push({ status: 'rejected', key, reason: rejectReason, rowNumber })
      continue
    }

    const before = existingByKey.get(key)
    if (!before) {
      outcomes.push({ status: 'new', key, data, notes, rowNumber })
    } else if (!equal(before, data)) {
      outcomes.push({ status: 'changed', key, data, notes, before, rowNumber })
    } else {
      outcomes.push({ status: 'unchanged', key, data, notes, rowNumber })
    }
  }

  outcomes.sort((a, b) => a.rowNumber - b.rowNumber)
  const counts = { new: 0, changed: 0, unchanged: 0, rejected: 0 }
  for (const o of outcomes) counts[o.status]++

  return { rows: outcomes, counts }
}
