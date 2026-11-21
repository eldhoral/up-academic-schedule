import { getCurrentUser } from '@/lib/roles'
import { isPenguji } from '@/lib/role-types'
import { canAccessProdi } from '@/lib/prodi'
import { convertXlsxToPdf } from '@/lib/aspose'
import { loadBeritaAcara } from '@/lib/penilaian/data'
import { buildBeritaAcaraPrasidangXlsx } from '@/lib/penilaian/berita-acara-prasidang-xlsx'

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

  const xlsx = await buildBeritaAcaraPrasidangXlsx(data)
  const nama = `Berita Acara Prasidang ${data.defense.npm} ${data.defense.nama_mahasiswa}`.replace(/[^\w .-]/g, '')

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
