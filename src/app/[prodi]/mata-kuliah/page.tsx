import { AppHeader } from '@/components/AppHeader'
import { prodiParam } from '@/lib/prodi-server'
import { createClient } from '@/lib/supabase/server'
import { MataKuliahClient, type Course } from './MataKuliahClient'

export default async function MataKuliahPage(props: PageProps<'/[prodi]/mata-kuliah'>) {
  const prodi = await prodiParam(props.params)
  const supabase = await createClient()
  const { data } = await supabase.from('courses').select('*').eq('prodi', prodi).order('smt').order('kode_mk')

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/mata-kuliah" prodi={prodi} />
      <main className="flex-1 p-[1.3rem] max-w-[1400px] w-full mx-auto">
        <MataKuliahClient courses={(data as Course[]) ?? []} />
      </main>
    </div>
  )
}
