import { PRODI_CONFIG } from '@/lib/prodi'
import { prodiParam } from '@/lib/prodi-server'
import { convertXlsxToPdf } from '@/lib/aspose'
import { jenisLabel } from '../../defense-types'
import { buildSidangCetakData } from '../sidang-cetak-data'
import { buildSidangXlsx } from '../build-sidang-xlsx'

export async function GET(request: Request, ctx: RouteContext<'/[prodi]/sidang/cetak/pdf'>) {
  const prodi = await prodiParam(ctx.params)
  const { searchParams } = new URL(request.url)
  const data = await buildSidangCetakData(prodi, { ay: searchParams.get('ay'), jenis: searchParams.get('jenis'), tanggal: searchParams.get('tanggal') })
  // An empty jadwal isn't worth an Aspose call.
  if (data.sheets.length === 0) return new Response('Tidak ada jadwal untuk dicetak', { status: 404 })

  const filename = `${PRODI_CONFIG[prodi].short} Jadwal ${jenisLabel(prodi, data.context.jenis)} ${data.academicYearLabel.replace(/\//g, '-')}.pdf`

  try {
    const pdf = await convertXlsxToPdf(await buildSidangXlsx({ ...data, jenis: data.context.jenis, prodi }))
    return new Response(pdf, {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` },
    })
  } catch (err) {
    // Quota exhausted, missing credentials, network hiccup -- the client shows a message.
    console.error('Aspose xlsx-to-PDF conversion failed:', err)
    return new Response('PDF conversion failed', { status: 502 })
  }
}
