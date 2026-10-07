import { PRODI_CONFIG } from '@/lib/prodi'
import { prodiParam } from '@/lib/prodi-server'
import { buildCetakData } from '../cetak-data'
import { buildXlsx } from '../build-xlsx'

export async function GET(request: Request, ctx: RouteContext<'/[prodi]/kuliah/cetak/xlsx'>) {
  const prodi = await prodiParam(ctx.params)
  const { searchParams } = new URL(request.url)
  const data = await buildCetakData(prodi, {
    ay: searchParams.get('ay'),
    jenis: searchParams.get('jenis'),
    smt: searchParams.get('smt'),
  })

  const buffer = await buildXlsx(data)
  const filename = `${PRODI_CONFIG[prodi].short} Jadwal Perkuliahan ${data.academicYearLabel.replace(/\//g, '-')}.xlsx`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
