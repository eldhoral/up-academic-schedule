import { getCurrentUser } from '@/lib/roles'
import { isPenguji } from '@/lib/role-types'
import { canAccessProdi } from '@/lib/prodi'
import { convertXlsxToPdf } from '@/lib/aspose'
import { loadPenilaian, loadSidang } from '@/lib/penilaian/data'
import { buildHasilBimbinganXlsx, hasilBimbinganDari, namaHasilBimbingan } from '@/lib/penilaian/hasil-bimbingan-xlsx'
import { getSettings } from '@/lib/settings'
import { kopBaris } from '@/lib/xlsx'

/**
 * The Nilai Bimbingan page with its Hasil Akhir as a file (?format=pdf|xlsx; kiprat 2026-11-27: "tambahin tombol download
 * pdf"). Staff with access to its prodi only; 404 until the sidang is locked. The PDF is the Excel file converted by Aspose.
 */
export async function GET(req: Request, ctx: RouteContext<'/api/hasil-bimbingan/[defenseId]'>) {
  const user = await getCurrentUser()
  if (!user) return new Response('Masuk terlebih dahulu.', { status: 401 })
  if (isPenguji(user.role)) return new Response('Akun ini tidak dapat mengunduh nilai bimbingan.', { status: 403 })
  const format = new URL(req.url).searchParams.get('format') === 'xlsx' ? 'xlsx' : 'pdf'

  const { defenseId } = await ctx.params
  // Admin client inside the loaders, after the staff check above.
  const data = await loadPenilaian(defenseId)
  if (!data) return new Response('Sidang tidak ditemukan.', { status: 404 })
  if (!canAccessProdi(user.prodiAccess, data.defense.prodi)) return new Response('Akun ini tidak dapat mengunduh nilai bimbingan.', { status: 403 })
  const sidang = data.kunci ? await loadSidang(defenseId) : null
  const isi = sidang && hasilBimbinganDari(data, sidang, kopBaris((await getSettings(data.defense.prodi)).kop_baris))
  if (!isi) return new Response('Hasil akhir belum tersedia: sidang belum dikunci.', { status: 404 })

  const xlsx = await buildHasilBimbinganXlsx(isi)
  const nama = namaHasilBimbingan(isi)
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
