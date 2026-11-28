import { notFound } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, canManage } from '@/lib/roles'
import { prodiParam } from '@/lib/prodi-server'
import { istilah, PRODI_CONFIG } from '@/lib/prodi'
import { loadAturan } from '@/lib/penilaian/aturan'
import { PenilaianClient } from './PenilaianClient'

export default async function PenilaianPage(props: PageProps<'/[prodi]/pengaturan/penilaian'>) {
  const prodi = await prodiParam(props.params)
  const user = await getCurrentUser()
  // Each prodi has its own rules (S2 since kiprat 2026-11-27); they are Super Admin's.
  if (!user || !canManage(user.role)) notFound()

  const aturan = await loadAturan(await createClient(), prodi)

  return (
    <AppShell active="/pengaturan/penilaian" prodi={prodi}>
      <main className="flex-1 p-[1.3rem] max-w-[900px] w-full mx-auto">
        <div className="mb-[1.2rem]">
          <h1 className="text-[1.3rem] font-semibold">Pengaturan Penilaian {PRODI_CONFIG[prodi].short}</h1>
          <p className="text-[0.93rem] text-[var(--tinta-3)] mt-[0.2rem]">
            {istilah(prodi, 'Aspek, Tabel Nilai, predikat dan SKS skripsi dipakai form penilaian dosen. Tiap bagian disimpan sendiri.')}
          </p>
        </div>
        <PenilaianClient aturan={aturan} />
      </main>
    </AppShell>
  )
}
