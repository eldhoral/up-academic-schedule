import { buildSidangCetakData } from '../sidang-cetak-data'
import { buildSidangXlsx } from '../build-sidang-xlsx'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const data = await buildSidangCetakData({ ay: searchParams.get('ay'), jenis: searchParams.get('jenis'), tanggal: searchParams.get('tanggal') })

  const buffer = await buildSidangXlsx({ ...data, jenis: data.context.jenis })
  const filename = `Jadwal ${data.context.jenis === 'sidang' ? 'Sidang' : 'Prasidang'} ${data.academicYearLabel.replace(/\//g, '-')}.xlsx`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
