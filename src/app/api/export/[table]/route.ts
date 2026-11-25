import { createClient } from '@/lib/supabase/server'
import { buildExportBuffer, type Dropdowns } from '@/lib/import/engine'
import { loadCourseSheet } from '@/lib/import/courses'
import { importTables, loadStudentSheet, type ImportTableSlug } from '@/lib/import/tables'
import { humanDbError } from '@/lib/db-error'
import { parseProdi } from '@/lib/prodi'

export async function GET(req: Request, ctx: RouteContext<'/api/export/[table]'>) {
  const { table } = await ctx.params
  const def = importTables[table as ImportTableSlug]
  if (!def) {
    return new Response('Data ekspor tidak dikenali.', { status: 404 })
  }

  const prodi = def.prodiScoped ? (parseProdi(new URL(req.url).searchParams.get('prodi')) ?? 's1') : null
  const supabase = await createClient()
  let query = supabase.from(def.slug).select('*').order(def.keyField)
  if (prodi) query = query.eq('prodi', prodi)
  const { data, error } = await query
  if (error) {
    return new Response(humanDbError(error), { status: 500 })
  }

  // The prodi column is dropped so the file re-imports cleanly, and the jadwal link token so the file never leaks lecturers' links.
  const rows = (data ?? []).map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'prodi' && k !== 'jadwal_token')))
  // Mahasiswa: Dosen Pembimbing as "Nama (KODE)" with a dropdown, ya/tidak; the import reads the kode back.
  // Mata Kuliah: one row per kurikulum membership, with a strict kurikulum dropdown.
  let body = rows
  let dropdowns: Dropdowns | undefined
  if (def.slug === 'students') {
    const sheet = await loadStudentSheet(supabase)
    body = rows.map(sheet.exportRow)
    dropdowns = sheet.dropdowns
  } else if (def.slug === 'courses') {
    const sheet = await loadCourseSheet(supabase)
    body = sheet.exportRows(rows)
    dropdowns = sheet.dropdowns
  }
  const buffer = await buildExportBuffer(body, dropdowns)
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${def.slug}${prodi ? `-${prodi}` : ''}-export.xlsx"`,
    },
  })
}
