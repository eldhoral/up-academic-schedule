import { buildRekapData } from '../rekap-data'
import { buildSuratDocx } from '../build-surat-docx'
import { convertDocxToPdf } from '../../cetak/aspose'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const data = await buildRekapData({
    ay: searchParams.get('ay'),
    dosen: searchParams.get('dosen'),
  })
  // Nothing to rekap -- don't spend an Aspose call converting an empty letter.
  if (data.lecturersToRender.length === 0) return new Response('Tidak ada dosen untuk direkap', { status: 404 })

  const filename = `Surat Penugasan ${data.academicYearLabel.replace(/\//g, '-')}.pdf`

  try {
    const pdf = await convertDocxToPdf(await buildSuratDocx(data))
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } catch (err) {
    // Quota exhausted, network hiccup, etc. -- the client falls back to the in-browser docx preview.
    console.error('Aspose docx-to-PDF conversion failed:', err)
    return new Response('PDF conversion failed', { status: 502 })
  }
}
