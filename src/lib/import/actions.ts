'use server'

import { createClient } from '@/lib/supabase/server'
import { classifyRows, parseWorkbookRows } from './engine'
import { importTables, type ImportTableSlug } from './tables'
import type { ImportPreview } from './engine'

export type PreviewState =
  | { ok: true; preview: ImportPreview<Record<string, unknown>> }
  | { ok: false; error: string }

export async function previewImportAction(
  tableSlug: ImportTableSlug,
  formData: FormData
): Promise<PreviewState> {
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose an .xlsx file first.' }
  }

  const def = importTables[tableSlug]
  const buffer = await file.arrayBuffer()
  const parsed = parseWorkbookRows(buffer)
  if (parsed.length === 0) {
    return { ok: false, error: 'The file has no data rows.' }
  }

  const supabase = await createClient()
  const { data: existingRows, error } = await supabase.from(def.slug).select('*')
  if (error) {
    return { ok: false, error: `Could not read existing ${def.label} rows: ${error.message}` }
  }

  const existingByKey = new Map<string, Record<string, unknown>>()
  for (const row of existingRows ?? []) {
    existingByKey.set(String((row as Record<string, unknown>)[def.keyField]), row as Record<string, unknown>)
  }

  const preview = classifyRows({
    parsed,
    parseRow: def.parseRow as never,
    existingByKey: existingByKey as never,
    equal: def.equal as never,
  })

  return { ok: true, preview: preview as ImportPreview<Record<string, unknown>> }
}

export type CommitState = { ok: true; written: number } | { ok: false; error: string }

export async function commitImportAction(
  tableSlug: ImportTableSlug,
  rows: Record<string, unknown>[]
): Promise<CommitState> {
  if (rows.length === 0) {
    return { ok: false, error: 'Nothing to commit.' }
  }

  const def = importTables[tableSlug]
  const supabase = await createClient()

  // A single upsert call is one SQL statement: all rows land or none do.
  const { error } = await supabase.from(def.slug).upsert(rows, { onConflict: def.keyField })
  if (error) {
    return { ok: false, error: error.message }
  }

  return { ok: true, written: rows.length }
}
