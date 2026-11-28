import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/roles'
import { isPenguji } from '@/lib/role-types'
import { canAccessProdi, parseProdi } from '@/lib/prodi'
import { loadRekapBimbingan, pilihTahun } from '@/lib/penilaian/rekap-data'
import { buildRekapBimbinganXlsx } from '@/lib/penilaian/rekap-xlsx'

/** Nilai Bimbingan recap of one tahun akademik (?year=<academic_years.id>, default the active one) as xlsx. Staff with access to that prodi (?prodi=s1|s2, default s1). */
export async function GET(req: Request) {
  const prodi = parseProdi(new URL(req.url).searchParams.get('prodi')) ?? 's1'
  const user = await getCurrentUser()
  if (!user) return new Response('Masuk terlebih dahulu.', { status: 401 })
  // The proxy already turns an examiner (DOSEN or EKSTERNAL) away; this check stands on its own.
  if (isPenguji(user.role) || !canAccessProdi(user.prodiAccess, prodi)) {
    return new Response('Akun ini tidak dapat mengunduh rekap nilai bimbingan.', { status: 403 })
  }

  const supabase = await createClient()
  const { ay } = await pilihTahun(supabase, new URL(req.url).searchParams.get('year'))
  const { rows, aturan } = await loadRekapBimbingan(supabase, prodi, ay)
  const buffer = await buildRekapBimbinganXlsx(rows, aturan.tabelNilai)
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="nilai-bimbingan-${prodi}-${ay.replace(/[^\w-]/g, '')}.xlsx"`,
    },
  })
}
