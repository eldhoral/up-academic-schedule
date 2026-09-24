import { buildRekapData } from '../rekap-data'
import { buildSuratXlsx } from '../build-surat-xlsx'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const data = await buildRekapData({
    ay: searchParams.get('ay'),
    dosen: searchParams.get('dosen'),
  })

  const buffer = await buildSuratXlsx(data)
  const filename = `Surat Penugasan ${data.academicYearLabel.replace(/\//g, '-')}.xlsx`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
