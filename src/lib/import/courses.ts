import { gabungKurikulum, sebagaiDaftar } from '@/lib/kurikulum'
import type { CombinedRow, ParsedOkay } from './engine'
import type { CourseRow } from './tables'

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
        ? sebagaiDaftar(existing.kurikulum)
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
