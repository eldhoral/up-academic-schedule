import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { MataKuliahClient, type Course } from './MataKuliahClient'

export default async function MataKuliahPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('courses').select('*').order('smt').order('kode_mk')

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/mata-kuliah" />
      <main className="flex-1 p-[1.3rem] max-w-[1400px] w-full mx-auto">
        <MataKuliahClient courses={(data as Course[]) ?? []} />
      </main>
    </div>
  )
}
