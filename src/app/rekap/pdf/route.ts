import { buildRekapData } from '../rekap-data'
import { buildSuratXlsx } from '../build-surat-xlsx'
import { convertXlsxToPdf } from '../../cetak/aspose'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const data = await buildRekapData({
    ay: searchParams.get('ay'),
    dosen: searchParams.get('dosen'),
  })
  const filename = `Surat Penugasan ${data.academicYearLabel.replace(/\//g, '-')}.pdf`

  const xlsx = await buildSuratXlsx(data)
  const buffer = await convertXlsxToPdf(xlsx)

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
