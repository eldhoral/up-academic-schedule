import * as XLSX from 'xlsx'

export type ParsedRow = Record<string, unknown>

/** Reads the first sheet of an uploaded workbook into row objects keyed by header. */
export function parseWorkbookRows(buffer: ArrayBuffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: '', raw: true })
}

/** Builds a downloadable .xlsx template: header row + one example row. */
export function buildTemplateBuffer(
  headers: string[],
  exampleRow: Record<string, string | number>
): Buffer {
  const rows = [headers, headers.map((h) => exampleRow[h] ?? '')]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Template')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

/** Builds a downloadable .xlsx of the current DB rows — column names match import headers, so it re-uploads cleanly. */
export function buildExportBuffer(rows: Record<string, unknown>[]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
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
