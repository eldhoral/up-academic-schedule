import { buildTemplateBuffer } from '@/lib/import/engine'
import { importTables, type ImportTableSlug } from '@/lib/import/tables'

export async function GET(_req: Request, ctx: RouteContext<'/api/import/[table]/template'>) {
  const { table } = await ctx.params
  const def = importTables[table as ImportTableSlug]
  if (!def) {
    return new Response('Unknown import table.', { status: 404 })
  }

  const buffer = buildTemplateBuffer(def.headers, def.exampleRow)
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${def.slug}-template.xlsx"`,
    },
  })
}
