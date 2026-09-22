import { createClient } from '@/lib/supabase/server'
import { buildExportBuffer } from '@/lib/import/engine'
import { importTables, type ImportTableSlug } from '@/lib/import/tables'

export async function GET(_req: Request, ctx: RouteContext<'/api/export/[table]'>) {
  const { table } = await ctx.params
  const def = importTables[table as ImportTableSlug]
  if (!def) {
    return new Response('Unknown export table.', { status: 404 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from(def.slug).select('*').order(def.keyField)
  if (error) {
    return new Response(error.message, { status: 500 })
  }

  const buffer = buildExportBuffer(data ?? [])
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${def.slug}-export.xlsx"`,
    },
  })
}
