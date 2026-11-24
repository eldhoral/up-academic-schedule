import { AppShell } from '@/components/AppShell'
import { createClient } from '@/lib/supabase/server'
import { canManage, getCurrentRole } from '@/lib/roles'
import { RuanganClient, type Room } from './RuanganClient'

export default async function RuanganPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('rooms').select('*').order('nama')

  return (
    <AppShell active="/ruangan">
      <main className="flex-1 p-[1.3rem] max-w-[1400px] w-full mx-auto">
        <RuanganClient rooms={(data as Room[]) ?? []} canEdit={canManage(await getCurrentRole())} />
      </main>
    </AppShell>
  )
}
