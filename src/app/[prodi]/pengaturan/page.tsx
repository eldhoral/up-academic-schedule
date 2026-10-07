import { AppHeader } from '@/components/AppHeader'
import { prodiParam } from '@/lib/prodi-server'
import { createClient } from '@/lib/supabase/server'
import { PengaturanClient, type SettingRow } from './PengaturanClient'

export default async function PengaturanPage(props: PageProps<'/[prodi]/pengaturan'>) {
  const prodi = await prodiParam(props.params)
  const supabase = await createClient()
  const { data } = await supabase.from('settings').select('*').order('group').order('urutan')

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/pengaturan" prodi={prodi} />
      <main className="flex-1 p-[1.3rem] max-w-[900px] w-full mx-auto">
        <div className="mb-[1.2rem]">
          <h1 className="text-[1.3rem] font-semibold">Pengaturan</h1>
          <p className="text-[0.93rem] text-[var(--tinta-3)] mt-[0.2rem]">
            Every rule the scheduler depends on — nothing is hardcoded.
          </p>
        </div>
        <PengaturanClient settings={(data as SettingRow[]) ?? []} />
      </main>
    </div>
  )
}
