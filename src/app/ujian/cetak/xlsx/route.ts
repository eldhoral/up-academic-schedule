import { buildUjianCetakData } from '../ujian-cetak-data'
import { buildUjianXlsx } from '../build-ujian-xlsx'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const data = await buildUjianCetakData({
    ay: searchParams.get('ay'),
    ujian: searchParams.get('ujian'),
    jenis: searchParams.get('jenis'),
    smt: searchParams.get('smt'),
  })

  const buffer = await buildUjianXlsx(data)
  const filename = `Jadwal ${data.context.jenis_ujian.toUpperCase()} ${data.academicYearLabel.replace(/\//g, '-')} ${data.context.jenis_kelas === 'reguler' ? 'Reguler' : 'Reguler Khusus'}.xlsx`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
