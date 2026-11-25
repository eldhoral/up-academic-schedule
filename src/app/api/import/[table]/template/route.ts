import { createClient } from '@/lib/supabase/server'
import { buildTemplateBuffer, type Dropdowns } from '@/lib/import/engine'
import { loadCourseSheet } from '@/lib/import/courses'
import { importTables, loadStudentSheet, type ImportTableSlug } from '@/lib/import/tables'

export async function GET(_req: Request, ctx: RouteContext<'/api/import/[table]/template'>) {
  const { table } = await ctx.params
  const def = importTables[table as ImportTableSlug]
  if (!def) {
    return new Response('Unknown import table.', { status: 404 })
  }

  // Mahasiswa: Dosen Pembimbing picked by name from a dropdown, with real dosen in the example row.
  // Mata Kuliah: kurikulum picked from the kurikulum seen in the DB, newest first.
  let sheet: { exampleRow: Record<string, string | number>; dropdowns: Dropdowns } | null = null
  if (def.slug === 'students') sheet = await loadStudentSheet(await createClient())
  else if (def.slug === 'courses') sheet = await loadCourseSheet(await createClient())
  const buffer = sheet
    ? await buildTemplateBuffer(def.headers, sheet.exampleRow, sheet.dropdowns)
    : await buildTemplateBuffer(def.headers, def.exampleRow)
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${def.slug}-template.xlsx"`,
    },
  })
}
