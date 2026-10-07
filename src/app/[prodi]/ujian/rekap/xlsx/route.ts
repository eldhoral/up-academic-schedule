import { PRODI_CONFIG } from '@/lib/prodi'
import { prodiParam } from '@/lib/prodi-server'
import { buildRekapPengawasData } from '../rekap-pengawas-data'
import { buildRekapPengawasXlsx } from '../build-rekap-pengawas-xlsx'

export async function GET(request: Request, ctx: RouteContext<'/[prodi]/ujian/rekap/xlsx'>) {
  const prodi = await prodiParam(ctx.params)
  const { searchParams } = new URL(request.url)
  const data = await buildRekapPengawasData(prodi, { ay: searchParams.get('ay'), ujian: searchParams.get('ujian'), pengawas: searchParams.get('pengawas') })

  const buffer = await buildRekapPengawasXlsx(data)
  const who = data.pengawas ? ` ${data.groups[0].nama.replace(/[\\/:*?"<>|]/g, '')}` : ''
  const filename = `${PRODI_CONFIG[prodi].short} Rekap Pengawas ${data.context.jenis_ujian.toUpperCase()} ${data.academicYearLabel.replace(/\//g, '-')}${who}.xlsx`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
