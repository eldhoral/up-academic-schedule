import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { buildCetakData } from '../cetak-data'
import { CetakDocument } from '../CetakDocument'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const data = await buildCetakData({
    ay: searchParams.get('ay'),
    jenis: searchParams.get('jenis'),
    smt: searchParams.get('smt'),
  })

  const buffer = await renderToBuffer(createElement(CetakDocument, data) as Parameters<typeof renderToBuffer>[0])
  const filename = `Jadwal Perkuliahan ${data.academicYearLabel.replace(/\//g, '-')}.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
