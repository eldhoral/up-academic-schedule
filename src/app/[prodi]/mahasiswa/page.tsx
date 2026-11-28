import { AppShell } from '@/components/AppShell'
import { prodiParam } from '@/lib/prodi-server'
import { createClient } from '@/lib/supabase/server'
import { canManage, getCurrentRole } from '@/lib/roles'
import { lecturerDisplayName } from '@/lib/import/tables'
import { statusPrasidang } from '@/lib/penilaian/rekap-prasidang'
import type { Hasil, PeranPrasidang } from '@/lib/penilaian/prasidang'
import { MahasiswaClient, type Student } from './MahasiswaClient'

export default async function MahasiswaPage(props: PageProps<'/[prodi]/mahasiswa'>) {
  const prodi = await prodiParam(props.params)
  const supabase = await createClient()
  const [{ data }, dosen, pras, isian, keputusan] = await Promise.all([
    supabase.from('students')
      .select('id, npm, nama, judul_skripsi, email, sks_sebelum, bobot_sebelum, tepat_waktu, pembimbing_1_kode, pembimbing_2_kode, tanpa_pembimbing_2')
      .eq('prodi', prodi).order('npm'),
    // Pembimbing and the prasidang / seminar proposal gate, both prodi (S2 since kiprat 2026-11-27).
    supabase.from('lecturers').select('kode_dosen, nama, gelar_depan, gelar_belakang, eksternal').order('nama'),
    supabase.from('defenses').select('id, npm, tanggal, created_at').eq('prodi', prodi).eq('jenis', 'prasidang'),
    supabase.from('berita_acara_prasidang').select('defense_id, peran, hasil'),
    supabase.from('keputusan_prasidang').select('npm, prasidang_id, hasil, alasan'),
  ])
  const err = dosen.error ?? pras.error ?? isian.error ?? keputusan.error
  if (err) throw new Error(`Gagal memuat data mahasiswa: ${err.message}`)

  const isi = (isian.data ?? []).map((x) => ({ defense_id: x.defense_id as string, peran: x.peran as PeranPrasidang, hasil: x.hasil as Hasil }))
  const kep = (keputusan.data ?? []).map((x) => ({ npm: x.npm as string, prasidang_id: x.prasidang_id as string | null, hasil: x.hasil as Hasil, alasan: x.alasan as string }))
  const students = ((data ?? []) as Omit<Student, 'status' | 'keputusan'>[]).map((s): Student => ({
    ...s,
    status: statusPrasidang(s.npm, pras.data ?? [], isi, kep),
    keputusan: kep.find((k) => k.npm === s.npm) ?? null,
  }))
  // Internal dosen for the pickers; a dosen already assigned stays listed even if flagged eksternal later.
  const dosenList = (dosen.data ?? []).map((l) => ({ kode: l.kode_dosen as string, nama: lecturerDisplayName(l), eksternal: !!l.eksternal }))

  return (
    <AppShell active="/mahasiswa" prodi={prodi}>
      <main className="flex-1 p-[1.3rem] max-w-[1400px] w-full mx-auto">
        <MahasiswaClient students={students} dosen={dosenList} canEdit={canManage(await getCurrentRole())} />
      </main>
    </AppShell>
  )
}
