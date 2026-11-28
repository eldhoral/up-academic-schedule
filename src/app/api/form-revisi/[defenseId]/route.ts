import { getCurrentUser } from '@/lib/roles'
import { isPenguji } from '@/lib/role-types'
import { canAccessProdi, istilah } from '@/lib/prodi'
import { convertXlsxToPdf } from '@/lib/aspose'
import { getSettings } from '@/lib/settings'
import { kopBaris } from '@/lib/xlsx'
import { PERAN_SIDANG, PERAN_SIDANG_LABEL } from '@/lib/penilaian/akses'
import { loadBeritaAcara, loadSidang } from '@/lib/penilaian/data'
import { buildFormRevisiXlsx, namaFormRevisi, type FormRevisi } from '@/lib/penilaian/form-revisi-xlsx'
import { PERAN_PRASIDANG, PERAN_PRASIDANG_LABEL, STATUS_LABEL } from '@/lib/penilaian/prasidang'

/**
 * The revisi form for the student of an S1 sidang or prasidang (?format=xlsx|pdf): each examiner's revisi as
 * filled so far. Staff with access to its prodi (S1 or S2) only. The PDF is the Excel file converted by Aspose.
 */
export async function GET(req: Request, ctx: RouteContext<'/api/form-revisi/[defenseId]'>) {
  const user = await getCurrentUser()
  if (!user) return new Response('Masuk terlebih dahulu.', { status: 401 })
  // Staff only; the prodi is checked once the record is loaded (S1 or S2).
  if (isPenguji(user.role)) {
    return new Response('Akun ini tidak dapat mengunduh form revisi.', { status: 403 })
  }
  const format = new URL(req.url).searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx'

  const { defenseId } = await ctx.params
  // Admin client inside the loaders, after the staff check above. Each returns null for the other jenis.
  const sidang = await loadSidang(defenseId)
  const prasidang = sidang ? null : await loadBeritaAcara(defenseId)
  if (!sidang && !prasidang) return new Response('Jadwal tidak ditemukan.', { status: 404 })
  const prodi = (sidang?.defense ?? prasidang!.defense).prodi
  if (!canAccessProdi(user.prodiAccess, prodi)) return new Response('Akun ini tidak dapat mengunduh form revisi.', { status: 403 })

  const form: FormRevisi = sidang
    ? {
      jenis: 'sidang', prodi, kolom: 'Halaman', hasil: sidang.hasil?.yudisium_label ?? null,
      npm: sidang.defense.npm, nama: sidang.defense.nama_mahasiswa, judul: sidang.defense.judul_skripsi, tanggal: sidang.defense.tanggal,
      bagian: PERAN_SIDANG.map((p) => {
        const n = sidang.nilai[p]
        return { peranLabel: PERAN_SIDANG_LABEL[p], nama: sidang.dosen[p], rows: n?.ada_revisi ? n.revisi.map((r) => ({ rujukan: r.halaman, catatan: r.catatan })) : [] }
      }),
    }
    : {
      jenis: 'prasidang', prodi, kolom: 'Pertanyaan', hasil: istilah(prodi, STATUS_LABEL[prasidang!.status]),
      npm: prasidang!.defense.npm, nama: prasidang!.defense.nama_mahasiswa, judul: prasidang!.defense.judul_skripsi, tanggal: prasidang!.defense.tanggal,
      bagian: PERAN_PRASIDANG.map((p) => ({
        peranLabel: PERAN_PRASIDANG_LABEL[p],
        nama: prasidang!.dosen[p],
        rows: (prasidang!.isian[p]?.jawaban ?? []).filter((j) => j.catatan.trim()).map((j) => ({ rujukan: j.teks, catatan: j.catatan })),
      })),
    }

  const kop = kopBaris((await getSettings(prodi)).kop_baris)
  const xlsx = await buildFormRevisiXlsx({ ...form, kop })
  const nama = namaFormRevisi(form)

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
