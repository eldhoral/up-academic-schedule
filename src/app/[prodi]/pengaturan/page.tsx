import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, canWrite } from '@/lib/roles'
import { prodiParam } from '@/lib/prodi-server'
import { PRODI_CONFIG } from '@/lib/prodi'
import { PengaturanClient, type SettingRow } from './PengaturanClient'

export default async function PengaturanPage(props: PageProps<'/[prodi]/pengaturan'>) {
  const prodi = await prodiParam(props.params)
  const supabase = await createClient()
  const [{ data }, user] = await Promise.all([
    supabase.from('settings').select('*').in('prodi', [prodi, 'all']).order('group').order('urutan'),
    getCurrentUser(),
  ])

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/pengaturan" prodi={prodi} />
      <main className="flex-1 p-[1.3rem] max-w-[900px] w-full mx-auto">
        <div className="mb-[1.2rem]">
          <h1 className="text-[1.3rem] font-semibold">Pengaturan {PRODI_CONFIG[prodi].label}</h1>
          <p className="text-[0.93rem] text-[var(--tinta-3)] mt-[0.2rem]">
            Every rule the scheduler depends on — nothing is hardcoded.
          </p>
        </div>
        <PengaturanClient
          settings={(data as SettingRow[]) ?? []}
          canEditShared={!!user && canWrite(user.role) && user.prodiAccess === 'all'}
        />
      </main>
    </div>
  )
}
