import { prodiParam } from '@/lib/prodi-server'
import { PRODI_CONFIG } from '@/lib/prodi'
import { buildRekapData } from '../rekap-data'
import { buildSuratDocx } from '../build-surat-docx'

export async function GET(request: Request, ctx: RouteContext<'/[prodi]/kuliah/rekap/docx'>) {
  const prodi = await prodiParam(ctx.params)
  const { searchParams } = new URL(request.url)
  const data = await buildRekapData(prodi, {
    ay: searchParams.get('ay'),
    dosen: searchParams.get('dosen'),
  })

  const buffer = await buildSuratDocx(data)
  const filename = `${PRODI_CONFIG[prodi].short} Surat Penugasan ${data.academicYearLabel.replace(/\//g, '-')}.docx`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
