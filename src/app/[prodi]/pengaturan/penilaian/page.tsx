import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, canManage } from '@/lib/roles'
import { prodiParam } from '@/lib/prodi-server'
import { loadAturan } from '@/lib/penilaian/aturan'
import { PenilaianClient } from './PenilaianClient'

export default async function PenilaianPage(props: PageProps<'/[prodi]/pengaturan/penilaian'>) {
  const prodi = await prodiParam(props.params)
  const user = await getCurrentUser()
  // Online grading is S1 only, and the rules are Super Admin's.
  if (prodi !== 's1' || !user || !canManage(user.role)) notFound()

  const aturan = await loadAturan(await createClient(), 's1')

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/pengaturan/penilaian" prodi={prodi} />
      <main className="flex-1 p-[1.3rem] max-w-[900px] w-full mx-auto">
        <div className="mb-[1.2rem]">
          <h1 className="text-[1.3rem] font-semibold">Pengaturan Penilaian S1</h1>
          <p className="text-[0.93rem] text-[var(--tinta-3)] mt-[0.2rem]">
            Aspek, Tabel Nilai, predikat dan SKS skripsi dipakai form penilaian dosen. Tiap bagian disimpan sendiri.
          </p>
        </div>
        <PenilaianClient aturan={aturan} />
      </main>
    </div>
  )
}
