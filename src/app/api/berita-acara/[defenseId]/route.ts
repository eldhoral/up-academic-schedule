import { getCurrentUser } from '@/lib/roles'
import { isPenguji } from '@/lib/role-types'
import { canAccessProdi } from '@/lib/prodi'
import { convertXlsxToPdf } from '@/lib/aspose'
import { loadSidang } from '@/lib/penilaian/data'
import { beritaAcaraDariSidang, buildBeritaAcaraXlsx } from '@/lib/penilaian/berita-acara-xlsx'
import { namaBeritaAcara } from '@/lib/penilaian/berita-acara-prasidang-xlsx'
import { getSettings } from '@/lib/settings'
import { kopBaris } from '@/lib/xlsx'

/**
 * A locked sidang's berita acara, S1 or S2 (?format=xlsx|pdf). Staff with access to its prodi only; 404 for anything else,
 * including a sidang not locked yet (no yudisium). The PDF is the Excel file converted by Aspose.
 */
export async function GET(req: Request, ctx: RouteContext<'/api/berita-acara/[defenseId]'>) {
  const user = await getCurrentUser()
  if (!user) return new Response('Masuk terlebih dahulu.', { status: 401 })
  // Staff only; the prodi is checked once the record is loaded (S1 or S2).
  if (isPenguji(user.role)) {
    return new Response('Akun ini tidak dapat mengunduh berita acara.', { status: 403 })
  }
  const format = new URL(req.url).searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx'

  const { defenseId } = await ctx.params
  // Admin client inside loadSidang, after the staff check above.
  const data = await loadSidang(defenseId)
  if (data && !canAccessProdi(user.prodiAccess, data.defense.prodi)) return new Response('Akun ini tidak dapat mengunduh berita acara.', { status: 403 })
  const isi = data && beritaAcaraDariSidang(data, kopBaris((await getSettings(data.defense.prodi)).kop_baris))
  if (!data || !isi) return new Response('Berita acara belum tersedia: sidang belum dikunci.', { status: 404 })

  const { defense } = data
  const xlsx = await buildBeritaAcaraXlsx(isi)
  const nama = namaBeritaAcara('Sidang', defense.academic_year_id, defense.nama_mahasiswa)

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
    // Quota exhausted, missing credentials, network hiccup: the Excel download still works.
    console.error('Aspose xlsx-to-PDF conversion failed:', err)
    return new Response('PDF gagal dibuat, coba lagi atau unduh Excel.', { status: 502 })
  }
}
