import { redirect } from 'next/navigation'
import { AppHeader } from '@/components/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/roles'
import { PenggunaClient, type Profile, type DosenOption } from './PenggunaClient'

export default async function PenggunaPage() {
  const me = await getCurrentUser()
  if (!me) redirect('/masuk')
  if (me.role !== 'SUPERADMIN') redirect('/')

  const supabase = await createClient()
  const [{ data }, { data: lecturers }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('lecturers').select('kode_dosen, nama, eksternal').order('nama'),
  ])

  return (
    <div className="min-h-screen flex flex-col bg-[var(--kertas)] text-[var(--tinta)]">
      <AppHeader active="/pengguna" />
      <main className="flex-1 p-[1.3rem] max-w-[1400px] w-full mx-auto">
        <PenggunaClient users={(data as Profile[]) ?? []} currentUserId={me.id} dosen={(lecturers as DosenOption[]) ?? []} />
      </main>
    </div>
  )
}
