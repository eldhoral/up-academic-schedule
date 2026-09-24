import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { buildCetakData } from '../cetak-data'
import { buildXlsx } from '../build-xlsx'
import { convertXlsxToPdf } from '../aspose'
import { CetakDocument } from '../CetakDocument'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const data = await buildCetakData({
    ay: searchParams.get('ay'),
    jenis: searchParams.get('jenis'),
    smt: searchParams.get('smt'),
  })
  const filename = `Jadwal Perkuliahan ${data.academicYearLabel.replace(/\//g, '-')}.pdf`

  let buffer: Uint8Array<ArrayBuffer>
  try {
    const xlsx = await buildXlsx(data)
    buffer = await convertXlsxToPdf(xlsx)
  } catch (err) {
    // Free-tier quota exhausted, network hiccup, etc. -- fall back to the
    // hand-built renderer rather than breaking the preview entirely.
    console.error('Aspose xlsx-to-PDF conversion failed, falling back to react-pdf:', err)
    const pdfBuffer = await renderToBuffer(createElement(CetakDocument, data) as Parameters<typeof renderToBuffer>[0])
    buffer = new Uint8Array(pdfBuffer)
  }

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
