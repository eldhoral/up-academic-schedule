import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { RuanganClient, type Room } from './RuanganClient'

export default async function RuanganPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('rooms').select('*').order('nama')

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/ruangan" />
      <main className="flex-1 p-[1.3rem] max-w-[1400px] w-full mx-auto">
        <RuanganClient rooms={(data as Room[]) ?? []} />
      </main>
    </div>
  )
}
