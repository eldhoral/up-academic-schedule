'use server'

import { createClient } from '@/lib/supabase/server'
import { classifyRows, parseWorkbookRows } from './engine'
import { importTables, type ImportTableSlug } from './tables'
import type { ImportPreview } from './engine'
import { humanDbError } from '@/lib/db-error'
import { parseProdi, PRODI_CONFIG, type Prodi } from '@/lib/prodi'
import { writableProdi } from '@/lib/prodi-server'

export type PreviewState =
  | { ok: true; preview: ImportPreview<Record<string, unknown>> }
  | { ok: false; error: string }

export async function previewImportAction(
  tableSlug: ImportTableSlug,
  formData: FormData
): Promise<PreviewState> {
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Pilih file .xlsx terlebih dahulu.' }
  }

  const def = importTables[tableSlug]
  const prodi = def.prodiScoped ? parseProdi(formData.get('prodi')) : null
  if (def.prodiScoped && !prodi) return { ok: false, error: 'Prodi tidak dikenali.' }
  const buffer = await file.arrayBuffer()
  const parsed = parseWorkbookRows(buffer)
  if (parsed.length === 0) {
    return { ok: false, error: 'File tidak memiliki baris data.' }
  }

  const supabase = await createClient()
  const { data: existingRows, error } = await supabase.from(def.slug).select('*')
  if (error) {
    return { ok: false, error: `Gagal membaca data ${def.label} yang ada. ${humanDbError(error)}` }
  }

  const existingByKey = new Map<string, Record<string, unknown>>()
  const otherProdiKeys = new Set<string>()
  for (const row of (existingRows ?? []) as Record<string, unknown>[]) {
    const key = String(row[def.keyField])
    if (prodi && row.prodi !== prodi) otherProdiKeys.add(key)
    else existingByKey.set(key, row)
  }

  const preview = classifyRows({
    parsed,
    parseRow: def.parseRow as never,
    existingByKey: existingByKey as never,
    equal: def.equal as never,
    otherProdiKeys,
  })
  if (prodi && tableSlug === 'courses') {
    // S2 runs semesters 1-4; say so per row rather than failing the whole commit.
    const max = PRODI_CONFIG[prodi].semesters
    // classifyRows keeps one outcome per parsed row, in order, so index i is spreadsheet row i + 2.
    preview.rows = preview.rows.map((r, i) =>
      r.status !== 'rejected' && Number((r.data as { smt?: number }).smt) > max
        ? { status: 'rejected' as const, key: r.key, reason: `${r.key}: smt harus antara 1 dan ${max}.`, rowNumber: i + 2 }
        : r,
    )
    preview.counts = { new: 0, changed: 0, unchanged: 0, rejected: 0 }
    for (const r of preview.rows) preview.counts[r.status]++
  }

  return { ok: true, preview: preview as ImportPreview<Record<string, unknown>> }
}

export type CommitState = { ok: true; written: number } | { ok: false; error: string }

export async function commitImportAction(
  tableSlug: ImportTableSlug,
  rows: Record<string, unknown>[],
  prodi?: Prodi
): Promise<CommitState> {
  if (rows.length === 0) {
    return { ok: false, error: 'Tidak ada data untuk disimpan.' }
  }

  const def = importTables[tableSlug]
  let payload = rows
  if (def.prodiScoped) {
    const gate = await writableProdi(prodi)
    if ('error' in gate) return { ok: false, error: gate.error }
    payload = rows.map((r) => ({ ...r, prodi: gate.prodi }))
  }
  const supabase = await createClient()

  // A single upsert call is one SQL statement: all rows land or none do.
  const { error } = await supabase.from(def.slug).upsert(payload, { onConflict: def.keyField })
  if (error) {
    return { ok: false, error: humanDbError(error, def.label) }
  }

  return { ok: true, written: rows.length }
}
