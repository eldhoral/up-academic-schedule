import { getCurrentUser } from '@/lib/roles'
import { isPenguji } from '@/lib/role-types'
import { canAccessProdi } from '@/lib/prodi'
import { convertXlsxToPdf } from '@/lib/aspose'
import { PERAN_SIDANG } from '@/lib/penilaian/akses'
import { loadSidang } from '@/lib/penilaian/data'
import { buildBeritaAcaraXlsx } from '@/lib/penilaian/berita-acara-xlsx'

/**
 * A locked S1 sidang's berita acara (?format=xlsx|pdf). Staff with S1 access only; 404 for anything else,
 * including a sidang not locked yet (no yudisium). The PDF is the Excel file converted by Aspose.
 */
export async function GET(req: Request, ctx: RouteContext<'/api/berita-acara/[defenseId]'>) {
  const user = await getCurrentUser()
  if (!user) return new Response('Masuk terlebih dahulu.', { status: 401 })
  if (isPenguji(user.role) || !canAccessProdi(user.prodiAccess, 's1')) {
    return new Response('Akun ini tidak dapat mengunduh berita acara.', { status: 403 })
  }
  const format = new URL(req.url).searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx'

  const { defenseId } = await ctx.params
  // Admin client inside loadSidang, after the staff check above.
  const data = await loadSidang(defenseId)
  if (!data?.hasil?.aturan) return new Response('Berita acara belum tersedia: sidang belum dikunci.', { status: 404 })

  const { defense, hasil, student } = data
  const xlsx = await buildBeritaAcaraXlsx({
    npm: defense.npm, nama: defense.nama_mahasiswa, judul: defense.judul_skripsi, tanggal: defense.tanggal,
    pembimbing1: student.pembimbing1, pembimbing2: student.pembimbing2,
    penguji: PERAN_SIDANG.map((p) => ({ peran: p, nama: data.dosen[p], nilai: data.nilai[p]?.nilai ?? null })),
    aturan: hasil.aturan!, pilihan: data.aturan.pilihanYudisium,
    yudisium: { label: hasil.yudisium_label, lulus: hasil.yudisium_lulus },
    sks: student.sks, bobot: student.bobot, tepatWaktu: student.tepatWaktu,
  })
  const nama = `Berita Acara Sidang ${defense.npm} ${defense.nama_mahasiswa}`.replace(/[^\w .-]/g, '')

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
