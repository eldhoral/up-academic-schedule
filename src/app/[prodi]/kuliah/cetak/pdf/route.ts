import { PRODI_CONFIG } from '@/lib/prodi'
import { prodiParam } from '@/lib/prodi-server'
import { buildCetakData } from '../cetak-data'
import { buildXlsx } from '../build-xlsx'
import { convertXlsxToPdf } from '@/lib/aspose'

export async function GET(request: Request, ctx: RouteContext<'/[prodi]/kuliah/cetak/pdf'>) {
  const prodi = await prodiParam(ctx.params)
  const { searchParams } = new URL(request.url)
  const data = await buildCetakData(prodi, {
    ay: searchParams.get('ay'),
    jenis: searchParams.get('jenis'),
    smt: searchParams.get('smt'),
  })
  // An empty jadwal isn't worth an Aspose call.
  if (data.sheets.every((sheet) => sheet.schedules.length === 0)) return new Response('Tidak ada jadwal untuk dicetak', { status: 404 })

  const filename = `${PRODI_CONFIG[prodi].short} Jadwal Perkuliahan ${data.academicYearLabel.replace(/\//g, '-')}.pdf`

  try {
    const pdf = await convertXlsxToPdf(await buildXlsx(data))
    return new Response(pdf, {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` },
    })
  } catch (err) {
    // Quota exhausted, missing credentials, network hiccup -- the client shows a message.
    console.error('Aspose xlsx-to-PDF conversion failed:', err)
    return new Response('PDF conversion failed', { status: 502 })
  }
}
