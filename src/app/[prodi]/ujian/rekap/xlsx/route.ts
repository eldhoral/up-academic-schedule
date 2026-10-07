import { buildRekapPengawasData } from '../rekap-pengawas-data'
import { buildRekapPengawasXlsx } from '../build-rekap-pengawas-xlsx'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const data = await buildRekapPengawasData({ ay: searchParams.get('ay'), ujian: searchParams.get('ujian'), pengawas: searchParams.get('pengawas') })

  const buffer = await buildRekapPengawasXlsx(data)
  const who = data.pengawas ? ` ${data.groups[0].nama.replace(/[\\/:*?"<>|]/g, '')}` : ''
  const filename = `Rekap Pengawas ${data.context.jenis_ujian.toUpperCase()} ${data.academicYearLabel.replace(/\//g, '-')}${who}.xlsx`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
