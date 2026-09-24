import { buildCetakData } from '../cetak-data'
import { buildXlsx } from '../build-xlsx'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const data = await buildCetakData({
    ay: searchParams.get('ay'),
    jenis: searchParams.get('jenis'),
    smt: searchParams.get('smt'),
  })

  const buffer = await buildXlsx(data)
  const filename = `Jadwal Perkuliahan ${data.academicYearLabel.replace(/\//g, '-')}.xlsx`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
