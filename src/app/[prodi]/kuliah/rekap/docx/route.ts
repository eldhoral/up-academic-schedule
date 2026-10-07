import { buildRekapData } from '../rekap-data'
import { buildSuratDocx } from '../build-surat-docx'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const data = await buildRekapData({
    ay: searchParams.get('ay'),
    dosen: searchParams.get('dosen'),
  })

  const buffer = await buildSuratDocx(data)
  const filename = `Surat Penugasan ${data.academicYearLabel.replace(/\//g, '-')}.docx`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
