import { getCurrentUser } from '@/lib/roles'
import { isPenguji } from '@/lib/role-types'
import { canAccessProdi } from '@/lib/prodi'
import { convertXlsxToPdf } from '@/lib/aspose'
import { loadBeritaAcara } from '@/lib/penilaian/data'
import { buildBeritaAcaraPrasidangXlsx, namaBeritaAcaraPrasidang } from '@/lib/penilaian/berita-acara-prasidang-xlsx'
import { getSettings } from '@/lib/settings'
import { kopBaris } from '@/lib/xlsx'

/**
 * An S1 prasidang's berita acara (?format=xlsx|pdf), as filled so far. Staff with S1 access only; 404 for
 * anything else. The PDF is the Excel file converted by Aspose.
 */
export async function GET(req: Request, ctx: RouteContext<'/api/berita-acara-prasidang/[defenseId]'>) {
  const user = await getCurrentUser()
  if (!user) return new Response('Masuk terlebih dahulu.', { status: 401 })
  if (isPenguji(user.role) || !canAccessProdi(user.prodiAccess, 's1')) {
    return new Response('Akun ini tidak dapat mengunduh berita acara.', { status: 403 })
  }
  const format = new URL(req.url).searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx'

  const { defenseId } = await ctx.params
  // Admin client inside loadBeritaAcara, after the staff check above.
  const data = await loadBeritaAcara(defenseId)
  if (!data) return new Response('Prasidang tidak ditemukan.', { status: 404 })

  // The kop and the cetak penandatangan (Ketua Program Studi), with the signature image.
  const s = await getSettings('s1', true)
  const xlsx = await buildBeritaAcaraPrasidangXlsx(data, {
    kop: kopBaris(s.kop_baris), jabatan: s.jabatan_penandatangan ?? '', nama: s.nama_penandatangan ?? '', gambarTandaTangan: s.gambar_tanda_tangan ?? '',
  })
  const nama = namaBeritaAcaraPrasidang(data)

  if (format === 'xlsx') {
    return new Response(xlsx, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nama}.xlsx"`,
      },
    })
  }
  try {
    const pdf = await convertXlsxToPdf(xlsx)
    return new Response(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${nama}.pdf"` } })
  } catch (err) {
    console.error('Aspose xlsx-to-PDF conversion failed:', err)
    return new Response('PDF gagal dibuat, coba lagi atau unduh Excel.', { status: 502 })
  }
}
