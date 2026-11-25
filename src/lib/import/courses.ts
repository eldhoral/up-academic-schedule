import { daftarKurikulum, gabungKurikulum, sebagaiDaftar } from '@/lib/kurikulum'
import type { CombinedRow, ParsedOkay } from './engine'
import { coursesTable, type CourseRow } from './tables'
import type { SupabaseClient } from '@supabase/supabase-js'

/** The fields shared by every kurikulum of one kode_mk. */
function samaDataMk(a: CourseRow, b: CourseRow): boolean {
  return a.nama_mk === b.nama_mk && a.sks === b.sks && a.jenis_mk === b.jenis_mk && a.smt === b.smt
}

function perubahanDataMk(sebelum: CourseRow, sesudah: CourseRow): string {
  const changes: string[] = []
  if (sebelum.nama_mk !== sesudah.nama_mk) changes.push(`nama "${sebelum.nama_mk}" → "${sesudah.nama_mk}"`)
  if (sebelum.sks !== sesudah.sks) changes.push(`SKS ${sebelum.sks} → ${sesudah.sks}`)
  if (sebelum.jenis_mk !== sesudah.jenis_mk) changes.push(`jenis "${sebelum.jenis_mk}" → "${sesudah.jenis_mk}"`)
  if (sebelum.smt !== sesudah.smt) changes.push(`semester ${sebelum.smt} → ${sesudah.smt}`)
  return changes.join(', ')
}

/**
 * One kode_mk is one DB row: merge its rows (one per kurikulum from the file) into one upsert row.
 * Memberships only grow here — an import never removes one by omission; removal is an explicit UI action.
 */
export function combineCourseRows(
  rows: ParsedOkay<CourseRow>[],
  existingByKey: Map<string, CourseRow>
): CombinedRow<CourseRow>[] {
  const groups = new Map<string, ParsedOkay<CourseRow>[]>()
  for (const row of rows) {
    const group = groups.get(row.key)
    if (group) group.push(row)
    else groups.set(row.key, [row])
  }

  const out: CombinedRow<CourseRow>[] = []
  for (const [key, group] of groups) {
    const first = group[0]
    if (!group.every((r) => samaDataMk(r.data, first.data))) {
      out.push({
        key,
        reason: `"${key}" muncul dengan nama/SKS/semester/jenis berbeda di file. Satu kode mata kuliah hanya boleh punya satu data; gunakan kode berbeda untuk versi yang berbeda.`,
        rowNumber: first.rowNumber,
      })
      continue
    }

    const dariFile = gabungKurikulum(undefined, group.map((r) => r.data.kurikulum))
    const existing = existingByKey.get(key)
    // A blank kurikulum cell leaves existing memberships alone; a new kode starts at 2026.
    const anggota = dariFile.length
      ? gabungKurikulum(existing?.kurikulum, dariFile)
      : existing
        ? gabungKurikulum(existing?.kurikulum, [])
        : ['2026']

    const notes = [...new Set(group.flatMap((r) => r.notes))]
    if (existing && !samaDataMk(existing, first.data)) {
      notes.push(`Data MK berubah untuk semua kurikulum: ${perubahanDataMk(existing, first.data)}.`)
    }
    notes.push(`Kurikulum: ${anggota.join(', ')}.`)

    out.push({ key, data: { ...first.data, kurikulum: anggota }, notes, rowNumber: first.rowNumber })
  }
  return out
}

// ---------------------------------------------------------------------------
// Mata Kuliah xlsx: kurikulum dropdown, one export row per membership
// ---------------------------------------------------------------------------

/**
 * The kurikulum options for the template/export, plus rows that re-import as memberships. Pure.
 * The dropdown is strict; the importer still accepts any non-blank hand-typed value.
 */
export function courseSheet(list: string[]) {
  const pilihan = list.length ? daftarKurikulum(list.map((kurikulum) => ({ kurikulum }))) : ['2026']
  return {
    dropdowns: { kurikulum: pilihan },
    exampleRow: { ...coursesTable.exampleRow, kurikulum: pilihan[0] },
    exportRows: (rows: Record<string, unknown>[]): Record<string, unknown>[] =>
      rows.flatMap((r) => {
        const anggota = sebagaiDaftar(r.kurikulum)
        return (anggota.length ? anggota : ['']).map((kurikulum) => ({ ...r, kurikulum }))
      }),
  }
}

/** The Mata Kuliah sheet extras with kurikulum read through `db` (session client: RLS decides). */
export async function loadCourseSheet(db: SupabaseClient) {
  const { data, error } = await db.from('courses').select('kurikulum')
  if (error) throw new Error(`Gagal memuat daftar kurikulum: ${error.message}`)
  return courseSheet(daftarKurikulum((data ?? []) as { kurikulum: unknown }[]))
}
