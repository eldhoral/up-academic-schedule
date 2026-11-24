import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { EmptySheet } from '@/components/EmptySheet'
import { prodiParam } from '@/lib/prodi-server'
import { canAccessProdi } from '@/lib/prodi'
import { canManage, canWrite, getCurrentUser } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { humanDbError } from '@/lib/db-error'
import { eksternalAktif } from '@/lib/penilaian/akses'
import { AkunClient, type Akun } from './AkunClient'

export default async function AkunEksternalPage(props: PageProps<'/[prodi]/sidang/akun-eksternal'>) {
  const prodi = await prodiParam(props.params)
  if (prodi !== 's1') notFound() // sidang grading is S1 only
  const user = await getCurrentUser()
  if (!user || !canWrite(user.role) || !canAccessProdi(user.prodiAccess, 's1')) notFound()

  // The session client: staff read akun_eksternal, profiles and defenses through RLS.
  const supabase = await createClient()
  const { data: akunRows, error } = await supabase
    .from('akun_eksternal')
    .select('user_id, kode_dosen, tanggal, username, lecturers(nama)')
    .order('tanggal', { ascending: false })
    .order('username')
  if (error) throw new Error(humanDbError(error))
  const rows = akunRows ?? []
  if (rows.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
        <AppHeader active="/sidang/akun-eksternal" prodi={prodi} />
        <EmptySheet
          title="Belum ada akun penguji eksternal"
          detail="Akun dibuat otomatis saat sidang skripsi disimpan dengan dosen eksternal sebagai Anggota Penguji I."
          actionHref={`/${prodi}/sidang`}
          actionLabel="Buka Jadwal Sidang"
        />
      </div>
    )
  }

  const [{ data: profiles, error: pErr }, { data: sidang, error: sErr }] = await Promise.all([
    supabase.from('profiles').select('id, berlaku_sampai').in('id', rows.map((r) => r.user_id)),
    supabase
      .from('defenses')
      .select('npm, nama_mahasiswa, tanggal, jam_mulai, penguji_eksternal_kode')
      .eq('prodi', 's1')
      .eq('jenis', 'sidang')
      .in('penguji_eksternal_kode', [...new Set(rows.map((r) => r.kode_dosen))])
      .in('tanggal', [...new Set(rows.map((r) => r.tanggal))])
      .order('jam_mulai'),
  ])
  if (pErr || sErr) throw new Error(humanDbError((pErr ?? sErr)!))

  const berlaku = new Map((profiles ?? []).map((p) => [p.id as string, p.berlaku_sampai as string | null]))
  const akun: Akun[] = rows.map((r) => {
    const sampai = berlaku.get(r.user_id) ?? null
    // A many-to-one embed: one lecturer object (typed loosely without generated DB types).
    const dosen = r.lecturers as unknown as { nama: string } | null
    return {
      userId: r.user_id,
      kode: r.kode_dosen,
      nama: dosen?.nama ?? r.kode_dosen,
      tanggal: r.tanggal,
      username: r.username,
      berlakuSampai: sampai,
      aktif: !!sampai && eksternalAktif(sampai),
      mahasiswa: (sidang ?? [])
        .filter((d) => d.penguji_eksternal_kode === r.kode_dosen && d.tanggal === r.tanggal)
        .map((d) => ({ npm: d.npm as string, nama: d.nama_mahasiswa as string, jam: (d.jam_mulai as string).slice(0, 5) })),
    }
  })

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/sidang/akun-eksternal" prodi={prodi} />
      <AkunClient akun={akun} bisaPerpanjang={canManage(user.role)} />
    </div>
  )
}
