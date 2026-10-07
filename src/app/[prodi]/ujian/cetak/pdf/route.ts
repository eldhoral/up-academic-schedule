import { PRODI_CONFIG } from '@/lib/prodi'
import { prodiParam } from '@/lib/prodi-server'
import { convertXlsxToPdf } from '@/lib/aspose'
import { buildUjianCetakData } from '../ujian-cetak-data'
import { buildUjianXlsx } from '../build-ujian-xlsx'

export async function GET(request: Request, ctx: RouteContext<'/[prodi]/ujian/cetak/pdf'>) {
  const prodi = await prodiParam(ctx.params)
  const { searchParams } = new URL(request.url)
  const data = await buildUjianCetakData(prodi, {
    ay: searchParams.get('ay'),
    ujian: searchParams.get('ujian'),
    jenis: searchParams.get('jenis'),
    smt: searchParams.get('smt'),
    dosen: searchParams.get('dosen'),
  })
  // An empty jadwal isn't worth an Aspose call.
  if (data.sheets.every((sheet) => sheet.rows.length === 0)) return new Response('Tidak ada jadwal untuk dicetak', { status: 404 })

  const filename = `${PRODI_CONFIG[prodi].short} Jadwal ${data.context.jenis_ujian.toUpperCase()} ${data.academicYearLabel.replace(/\//g, '-')}${PRODI_CONFIG[prodi].jenisKelas.length > 1 ? (data.context.jenis_kelas === 'reguler' ? ' Reguler' : ' Reguler Khusus') : ''}${data.dosen ? ` ${data.dosen.label.replace(/[\\/:*?"<>|]/g, '')}` : ''}.pdf`

  try {
    const pdf = await convertXlsxToPdf(await buildUjianXlsx(data))
    return new Response(pdf, {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` },
    })
  } catch (err) {
    // Quota exhausted, missing credentials, network hiccup -- the client shows a message.
    console.error('Aspose xlsx-to-PDF conversion failed:', err)
    return new Response('PDF conversion failed', { status: 502 })
  }
}
