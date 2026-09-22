import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { DosenClient, type Lecturer } from './DosenClient'

export default async function DosenPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('lecturers').select('*').order('nama')

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/dosen" />
      <main className="flex-1 p-[1.3rem] max-w-[1400px] w-full mx-auto">
        <DosenClient lecturers={(data as Lecturer[]) ?? []} />
      </main>
    </div>
  )
}
